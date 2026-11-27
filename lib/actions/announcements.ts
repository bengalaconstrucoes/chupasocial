"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { screenContent } from "@/lib/moderation";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.is_admin) return null;
  return { supabase, user };
}

export async function createAnnouncementAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores publicam avisos." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (title.length < 2) return { ok: false, error: "Escreva um título." };
  if (title.length > 120) return { ok: false, error: "O título pode ter até 120 caracteres." };
  if (!body) return { ok: false, error: "Escreva o aviso." };
  if (body.length > 4000) return { ok: false, error: "O aviso pode ter até 4000 caracteres." };

  const { error } = await admin.supabase.from("announcements").insert({
    author_id: admin.user.id,
    title,
    body,
    pinned,
  });

  if (error) return { ok: false, error: "Não foi possível publicar o aviso." };

  revalidatePath("/patches");
  return { ok: true, message: "Aviso publicado." };
}

export type AnnouncementReply = {
  id: string;
  announcement_id: string;
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

export async function replyAnnouncementAction(
  announcementId: string,
  body: string,
): Promise<{ ok: true; reply: AnnouncementReply } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!UUID.test(announcementId)) return { ok: false, error: "Aviso inválido." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Escreva uma resposta." };
  if (trimmed.length > 1000) return { ok: false, error: "A resposta pode ter até 1000 caracteres." };

  const screening = screenContent(trimmed);
  if (screening.blocked) return { ok: false, error: screening.reason ?? "Conteúdo não permitido." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, avatar_frame, muted_until")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.muted_until && new Date(profile.muted_until).getTime() > Date.now()) {
    return { ok: false, error: "Sua conta está silenciada pela moderação por enquanto." };
  }

  const { data, error } = await supabase
    .from("announcement_replies")
    .insert({ announcement_id: announcementId, author_id: user.id, body: trimmed })
    .select("id, announcement_id, author_id, body, created_at")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível enviar a resposta." };

  revalidatePath("/patches");
  return {
    ok: true,
    reply: {
      ...(data as AnnouncementReply),
      author: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            avatar_frame: profile.avatar_frame,
          }
        : null,
    },
  };
}

export async function toggleAnnouncementPinAction(
  announcementId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fixar avisos." };
  if (!UUID.test(announcementId)) return { ok: false, error: "Aviso inválido." };

  const { error } = await admin.supabase
    .from("announcements")
    .update({ pinned })
    .eq("id", announcementId);

  if (error) return { ok: false, error: "Não foi possível alterar o destaque." };

  revalidatePath("/patches");
  return { ok: true, message: pinned ? "Aviso fixado." : "Aviso desafixado." };
}
