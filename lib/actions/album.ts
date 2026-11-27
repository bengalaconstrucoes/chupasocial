"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
const ALBUM_LIMIT = 24;

export async function createAlbumPhotoAction(
  photoUrl: string,
  caption: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  if (!photoUrl.startsWith(`${STORAGE_PREFIX}post-media/${user.id}/album/`)) {
    return { ok: false, error: "Imagem inválida para o álbum." };
  }
  if (photoUrl.length > 600) return { ok: false, error: "Endereço de imagem muito longo." };

  const { count } = await supabase
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= ALBUM_LIMIT) {
    return { ok: false, error: `O álbum aceita até ${ALBUM_LIMIT} fotos.` };
  }

  const cleanCaption = caption.trim().slice(0, 120);

  const { error } = await supabase.from("profile_photos").insert({
    user_id: user.id,
    photo_url: photoUrl,
    caption: cleanCaption || null,
  });

  if (error) return { ok: false, error: "Não foi possível salvar a foto." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.username) revalidatePath(`/u/${profile.username}`);

  return { ok: true, message: "Foto adicionada ao álbum." };
}

export async function deleteAlbumPhotoAction(photoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data: photo } = await supabase
    .from("profile_photos")
    .select("id, user_id, photo_url")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo || photo.user_id !== user.id) {
    return { ok: false, error: "Foto não encontrada." };
  }

  const { error } = await supabase
    .from("profile_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Não foi possível remover a foto." };

  const marker = "/storage/v1/object/public/post-media/";
  const index = (photo.photo_url as string).indexOf(marker);
  if (index >= 0) {
    const path = (photo.photo_url as string).slice(index + marker.length);
    await supabase.storage.from("post-media").remove([path]);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.username) revalidatePath(`/u/${profile.username}`);

  return { ok: true, message: "Foto removida." };
}
