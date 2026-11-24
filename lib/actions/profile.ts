"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { USERNAME_PATTERN } from "@/lib/utils";

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;
  const bannerUrl = String(formData.get("banner_url") ?? "").trim() || null;

  if (displayName.length < 2) return { ok: false, error: "Informe um nome com 2+ caracteres." };
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "Nome de usuário inválido (3–20, letras/números/_)." };
  }
  if (bio.length > 280) return { ok: false, error: "A bio pode ter até 280 caracteres." };
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    return { ok: false, error: "O site deve começar com http:// ou https://." };
  }
  for (const url of [avatarUrl, bannerUrl]) {
    if (url && !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)) {
      return { ok: false, error: "Endereço de imagem inválido." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      bio,
      website: website || null,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
    })
    .eq("id", user.id);

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: false, error: "Esse nome de usuário já está em uso." };
    }
    return { ok: false, error: "Não foi possível salvar o perfil." };
  }

  revalidatePath("/settings");
  revalidatePath(`/u/${username}`);
  revalidatePath("/");
  return { ok: true, message: "Perfil atualizado." };
}

export async function updatePrivacyAction(isPrivate: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_private: isPrivate })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Não foi possível salvar a privacidade." };

  revalidatePath("/settings");
  revalidatePath("/");
  return {
    ok: true,
    message: isPrivate ? "Perfil privado ativado." : "Perfil público ativado.",
  };
}

export async function deactivateAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Não foi possível desativar a conta." };

  await supabase.auth.signOut();
  redirect("/?aviso=conta-desativada");
}

export async function reactivateAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: null })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Não foi possível reativar a conta." };
  revalidatePath("/");
  return { ok: true, message: "Conta reativada." };
}

export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  if (confirmation.trim().toUpperCase() !== "EXCLUIR") {
    return { ok: false, error: "Digite EXCLUIR para confirmar." };
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: "Não foi possível excluir a conta agora." };

  await supabase.auth.signOut();
  redirect("/?aviso=conta-excluida");
}
