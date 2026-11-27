"use server";

import { revalidatePath } from "next/cache";
import { searchGifs } from "@/lib/gifs";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, GifItem } from "@/lib/types";

type GifSearchResult = { ok: true; gifs: GifItem[] } | { ok: false; error: string };

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString().slice(0, 600);
  } catch {
    return null;
  }
}

export async function searchGifsAction(query: string): Promise<GifSearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para usar GIFs." };

  try {
    const gifs = await searchGifs(query);
    if (gifs.length === 0) {
      return { ok: false, error: "Nenhum GIF encontrado para essa busca." };
    }
    return { ok: true, gifs };
  } catch {
    return { ok: false, error: "A busca de GIFs está indisponível agora." };
  }
}

export async function fetchFavoriteGifsAction(): Promise<GifItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("gif_favorites")
    .select("gif_id, provider, title, url, preview_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(48);

  return (data ?? []).map((row: any) => ({
    id: row.gif_id,
    provider: row.provider,
    title: row.title,
    url: row.url,
    preview: row.preview_url,
  }));
}

export async function toggleFavoriteGifAction(gif: GifItem): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const url = safeUrl(gif.url);
  const preview = safeUrl(gif.preview ?? gif.url);
  if (!url || !preview) return { ok: false, error: "GIF inválido." };
  if (typeof gif.id !== "string" || gif.id.length < 1 || gif.id.length > 80) {
    return { ok: false, error: "GIF inválido." };
  }

  const { data: existing } = await supabase
    .from("gif_favorites")
    .select("gif_id")
    .eq("user_id", user.id)
    .eq("gif_id", gif.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("gif_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("gif_id", gif.id);
    if (error) return { ok: false, error: "Não foi possível remover o favorito." };
    revalidatePath("/messages");
    return { ok: true, message: "Removido dos favoritos." };
  }

  const { error } = await supabase.from("gif_favorites").insert({
    user_id: user.id,
    gif_id: gif.id,
    provider: (gif.provider ?? "giphy").slice(0, 20),
    title: (gif.title ?? "").slice(0, 120),
    url,
    preview_url: preview,
  });

  if (error) return { ok: false, error: "Não foi possível favoritar o GIF." };
  revalidatePath("/messages");
  return { ok: true, message: "GIF favoritado." };
}
