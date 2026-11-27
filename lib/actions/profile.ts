"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { normalizeAccent, normalizeNameFont } from "@/lib/profile-style";
import { normalizeAvatarFrame } from "@/lib/avatar-frames";
import { parseMusicUrl } from "@/lib/music";
import { USERNAME_PATTERN } from "@/lib/utils";

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const profileIsAdmin = Boolean(currentProfile?.is_admin);

  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;
  const bannerUrl = String(formData.get("banner_url") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim();
  const accentRaw = String(formData.get("accent_color") ?? "").trim();
  const nameFont = normalizeNameFont(String(formData.get("name_font") ?? ""));
  const flagRaw = String(formData.get("flag") ?? "").trim();
  const statusEmoji = String(formData.get("status_emoji") ?? "").trim();
  const statusText = String(formData.get("status_text") ?? "").trim();
  const favoriteSong = String(formData.get("favorite_song") ?? "").trim();
  const favoriteSongArtist = String(formData.get("favorite_song_artist") ?? "").trim();
  const songUrl = String(formData.get("song_url") ?? "").trim() || null;
  const avatarFrame = normalizeAvatarFrame(String(formData.get("avatar_frame") ?? "none"));
  const profileStyle = String(formData.get("profile_style") ?? "modern") === "y2k" ? "y2k" : "modern";
  const showStats = formData.get("show_stats") === "on";
  const showVisits = formData.get("show_visits") === "on";

  if (displayName.length < 2) return { ok: false, error: "Informe um nome com 2+ caracteres." };
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "Nome de usuário inválido (3–20, letras/números/_)." };
  }
  if (bio.length > 280) return { ok: false, error: "A bio pode ter até 280 caracteres." };
  if (location.length > 60) return { ok: false, error: "A localização pode ter até 60 caracteres." };
  if (statusText.length > 80) return { ok: false, error: "O status pode ter até 80 caracteres." };
  if (statusEmoji.length > 8) return { ok: false, error: "Use um emoji curto no status." };
  if (favoriteSong.length > 80 || favoriteSongArtist.length > 80) {
    return { ok: false, error: "A música favorita pode ter até 80 caracteres." };
  }
  if (flagRaw && !/^[a-z0-9-]{2,24}$/.test(flagRaw)) {
    return { ok: false, error: "Bandeira inválida." };
  }
  if (accentRaw && !normalizeAccent(accentRaw)) {
    return { ok: false, error: "Cor de destaque inválida." };
  }
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    return { ok: false, error: "O site deve começar com http:// ou https://." };
  }
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  const isGiphy = (url: string) => /^https:\/\/([a-z0-9-]+\.)?giphy\.com\//i.test(url);

  if (avatarUrl && !avatarUrl.startsWith(storagePrefix) && !isGiphy(avatarUrl)) {
    return { ok: false, error: "Endereço de foto inválido." };
  }
  if (bannerUrl && !bannerUrl.startsWith(storagePrefix)) {
    return { ok: false, error: "Endereço de banner inválido." };
  }
  if (songUrl && songUrl.length > 500) {
    return { ok: false, error: "O link da música é longo demais." };
  }
  if (songUrl && !songUrl.startsWith(storagePrefix) && !parseMusicUrl(songUrl)) {
    return {
      ok: false,
      error: "Cole um link do YouTube, Spotify, SoundCloud, Deezer ou Apple Music.",
    };
  }
  if (avatarFrame === "admin" && !profileIsAdmin) {
    return { ok: false, error: "A moldura da equipe é reservada para a administração." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      bio,
      website: website || null,
      location: location || null,
      accent_color: normalizeAccent(accentRaw),
      name_font: nameFont,
      flag: flagRaw || null,
      status_text: statusText || null,
      status_emoji: statusEmoji || null,
      favorite_song: favoriteSong || null,
      favorite_song_artist: favoriteSongArtist || null,
      song_url: songUrl,
      avatar_frame: avatarFrame,
      profile_style: profileStyle,
      show_stats: showStats,
      show_visits: showVisits,
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
