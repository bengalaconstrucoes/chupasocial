"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { screenContent } from "@/lib/moderation";

export type ChatMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_frame: string | null;
  } | null;
};

export async function sendChatMessageAction(
  body: string,
): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Escreva uma mensagem." };
  if (trimmed.length > 500) return { ok: false, error: "A mensagem pode ter até 500 caracteres." };

  const screening = screenContent(trimmed);
  if (screening.blocked) return { ok: false, error: screening.reason ?? "Conteúdo não permitido." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, avatar_frame, muted_until")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { ok: false, error: "Perfil não encontrado." };
  if (profile.muted_until && new Date(profile.muted_until).getTime() > Date.now()) {
    return { ok: false, error: "Sua conta está silenciada pela moderação por enquanto." };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ author_id: user.id, body: trimmed })
    .select("id, author_id, body, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: "Não foi possível enviar. Tente de novo." };
  }

  revalidatePath("/chat");

  return {
    ok: true,
    message: {
      id: data.id,
      author_id: data.author_id,
      body: data.body,
      created_at: data.created_at,
      author: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        avatar_frame: profile.avatar_frame,
      },
    },
  };
}
