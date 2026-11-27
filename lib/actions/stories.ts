"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

export async function createStoryAction(
  mediaUrl: string,
  mediaType: "image" | "video",
  caption: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!mediaUrl.startsWith(`${STORAGE_PREFIX}stories/${user.id}/`)) {
    return { ok: false, error: "Mídia inválida para o story." };
  }
  if (mediaUrl.length > 600) return { ok: false, error: "Endereço de mídia muito longo." };

  const cleanCaption = caption.trim().slice(0, 140);

  const { error } = await supabase.from("stories").insert({
    author_id: user.id,
    media_url: mediaUrl,
    media_type: mediaType,
    caption: cleanCaption || null,
  });

  if (error) return { ok: false, error: "Não foi possível publicar o story." };

  revalidatePath("/");
  return { ok: true, message: "Story publicado por 24 horas." };
}

export async function deleteStoryAction(storyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("author_id", user.id);
  if (error) return { ok: false, error: "Não foi possível apagar o story." };

  revalidatePath("/");
  return { ok: true };
}
