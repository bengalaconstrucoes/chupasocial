"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_PATTERN, safeNext, usernameFromEmail } from "@/lib/utils";

export type AuthState = { error?: string; success?: string };

async function getOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (value.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e o spam.";
  if (value.includes("user already registered") || value.includes("already been registered"))
    return "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.";
  if (
    value.includes("email rate limit") ||
    value.includes("over_email_send_rate_limit") ||
    value.includes("email_send_rate_limit")
  )
    return "Estamos no limite de envio de e-mails agora (o provedor libera poucos por hora). Tente de novo em alguns minutos — se a conta já foi criada, use “Reenviar confirmação” na tela de login.";
  if (value.includes("rate limit") || value.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (value.includes("password") && value.includes("at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (value.includes("unable to validate email")) return "Informe um e-mail válido.";
  return "Não foi possível concluir. Tente novamente em instantes.";
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  let username = String(formData.get("username") ?? "").trim().toLowerCase();

  if (!username) username = usernameFromEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "O nome de usuário deve ter de 3 a 20 caracteres, usando letras, números e _.",
    };
  }
  if (displayName.length < 2) {
    return { error: "Informe seu nome (mínimo 2 caracteres)." };
  }

  const supabase = await createClient();

  const { data: available, error: rpcError } = await supabase.rpc("is_username_available", {
    p_username: username,
  });
  if (rpcError) return { error: "Não foi possível validar o nome de usuário agora." };
  if (available === false) return { error: "Esse nome de usuário já está em uso." };

  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
    },
  });

  if (error) {
    if (/username/i.test(error.message)) {
      return { error: "Esse nome de usuário já está em uso." };
    }
    return { error: translateAuthError(error.message) };
  }

  redirect(`/login?aviso=confirme&email=${encodeURIComponent(email)}`);
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));

  if (!email || !password) return { error: "Preencha e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translateAuthError(error.message) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("deactivated_at")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();

  if (profile?.deactivated_at) {
    await supabase
      .from("profiles")
      .update({ deactivated_at: null })
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Informe seu e-mail." };

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." };
  }

  return {
    success:
      "Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também o spam.",
  };
}

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { error: "Link expirado. Solicite uma nova recuperação de senha." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  redirect("/?aviso=senha-atualizada");
}

export async function resendConfirmationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Informe seu e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/confirm?next=/` },
  });

  if (error && /rate limit|too many/i.test(error.message)) {
    return {
      error:
        "Limite de envio de e-mails atingido. Aguarde alguns minutos antes de pedir outro link.",
    };
  }
  if (error) return { error: translateAuthError(error.message) };

  return { success: "Link reenviado. Confira sua caixa de entrada." };
}
