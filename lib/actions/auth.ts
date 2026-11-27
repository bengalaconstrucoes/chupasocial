"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_CODE_COOKIE,
  generateRecoveryCode,
  hashRecoveryCode,
  syntheticEmail,
} from "@/lib/account-recovery";
import { verifyCaptcha } from "@/lib/captcha";
import { USERNAME_PATTERN, safeNext } from "@/lib/utils";

export type AuthState = { error?: string; success?: string };
export type RecoveryState = AuthState & { code?: string };

function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Usuário ou senha incorretos.";
  if (value.includes("email not confirmed"))
    return "Esta conta antiga ainda não confirmou o e-mail. Entre com e-mail e senha ou use o código de recuperação.";
  if (value.includes("user already registered") || value.includes("already been registered"))
    return "Este usuário já está cadastrado. Tente entrar.";
  if (
    value.includes("email rate limit") ||
    value.includes("over_email_send_rate_limit") ||
    value.includes("email_send_rate_limit")
  )
    return "O envio de e-mails está desativado no momento.";
  if (value.includes("rate limit") || value.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (value.includes("password") && value.includes("at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (value.includes("unable to validate email") || value.includes("invalid email"))
    return "Não foi possível validar o cadastro agora. Tente outro nome de usuário.";
  return "Não foi possível concluir. Tente novamente em instantes.";
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();

  // Proteção contra bots: honeypot, tempo mínimo de preenchimento e captcha.
  if (String(formData.get("company") ?? "").trim()) {
    return { error: "Não foi possível concluir o cadastro agora." };
  }
  const elapsed = Number(formData.get("elapsed_ms") ?? 0);
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 1200) {
    return { error: "Muito rápido! Leia o desafio e tente novamente." };
  }
  const captchaOk = verifyCaptcha(
    String(formData.get("captcha_nonce") ?? ""),
    String(formData.get("captcha_token") ?? ""),
    String(formData.get("captcha_answer") ?? ""),
  );
  if (!captchaOk) {
    return { error: "Resposta do desafio incorreta. Recarregue a página e tente de novo." };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "O nome de usuário deve ter de 3 a 20 caracteres, usando letras, números e _.",
    };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
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

  // Um cadastro antigo pode ter deixado uma conta de auth sem perfil (órfã)
  // segurando esse e-mail sintético. Liberamos o nome antes de criar a conta.
  await supabase.rpc("release_username", { p_username: username });

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail(username),
    password,
    options: { data: { username, display_name: displayName } },
  });

  if (error) {
    if (/username/i.test(error.message)) {
      return { error: "Esse nome de usuário já está em uso." };
    }
    return { error: translateAuthError(error.message) };
  }

  if (!data.session) {
    return {
      error:
        "Conta criada, mas não conseguimos entrar automaticamente. Tente entrar com seu usuário e senha.",
    };
  }

  const code = generateRecoveryCode();
  const { error: codeError } = await supabase.rpc("set_recovery_code", {
    p_hash: hashRecoveryCode(code),
  });

  const jar = await cookies();
  if (!codeError) {
    jar.set(RECOVERY_CODE_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  redirect(codeError ? "/conta-criada?erro=codigo" : "/conta-criada");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));

  if (!identifier || !password) return { error: "Preencha usuário e senha." };

  const supabase = await createClient();
  const usingEmail = identifier.includes("@");

  // Contas sem e-mail real usam um endereço sintético derivado do usuário
  // original. Se a pessoa trocou de @, resolvemos o endereço antigo aqui para
  // que o login funcione com o nome novo.
  let email = usingEmail ? identifier : syntheticEmail(identifier);
  if (!usingEmail) {
    const { data: original } = await supabase.rpc("login_username_for", {
      p_username: identifier,
    });
    if (typeof original === "string" && original.trim()) {
      email = syntheticEmail(original.trim());
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (!usingEmail) {
      const { data: hint } = await supabase.rpc("account_login_hint", {
        p_username: identifier,
      });
      if (hint === "email") {
        return {
          error:
            "Essa conta foi criada antes da mudança e entra com e-mail. Use seu e-mail no campo acima.",
        };
      }
    }
    return { error: translateAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("deactivated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.deactivated_at) {
      await supabase.from("profiles").update({ deactivated_at: null }).eq("id", user.id);
    }
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function recoverPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!username) return { error: "Informe seu nome de usuário." };
  if (!code) return { error: "Informe o código de recuperação." };
  if (password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_password_with_recovery_code", {
    p_username: username,
    p_hash: hashRecoveryCode(code),
    p_new_password: password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("recovery_missing"))
      return {
        error:
          "Esta conta ainda não tem código de recuperação. Entre na conta e gere um em Configurações → Conta.",
      };
    if (message.includes("recovery_locked"))
      return { error: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." };
    if (message.includes("recovery_invalid"))
      return { error: "Usuário ou código de recuperação não conferem." };
    if (message.includes("password_too_short"))
      return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
    return { error: "Não foi possível trocar a senha agora. Tente novamente." };
  }

  redirect("/login?aviso=senha-redefinida");
}

export async function regenerateRecoveryCodeAction(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Digite sua senha atual para gerar um código novo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { error: "Sessão expirada. Entre novamente." };

  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError) return { error: "Senha atual incorreta." };

  const code = generateRecoveryCode();
  const { error } = await supabase.rpc("set_recovery_code", {
    p_hash: hashRecoveryCode(code),
  });
  if (error) return { error: "Não foi possível gerar o código agora. Tente de novo." };

  return {
    success: "Código novo gerado. Guarde agora: ele não será mostrado outra vez.",
    code,
  };
}

export async function dismissRecoveryCodeAction() {
  const jar = await cookies();
  jar.delete(RECOVERY_CODE_COOKIE);
  redirect("/");
}
