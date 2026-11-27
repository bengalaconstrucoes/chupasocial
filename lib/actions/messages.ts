"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, MessageAttachment } from "@/lib/types";

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
const GIF_HOSTS = /^https:\/\/(media\d*\.giphy\.com|media\.tenor\.com|media\d*\.tenor\.com)\//i;

function parseAttachment(raw: unknown): MessageAttachment | null | "invalid" {
  if (!raw) return null;
  if (typeof raw !== "object") return "invalid";

  const candidate = raw as Record<string, unknown>;
  const type = candidate.type;
  const url = candidate.url;
  const previewUrl = candidate.previewUrl ?? url;

  if (type !== "image" && type !== "gif" && type !== "audio") return "invalid";
  if (typeof url !== "string" || typeof previewUrl !== "string") return "invalid";
  if (url.length > 600 || previewUrl.length > 600) return "invalid";

  const allowed = (value: string) =>
    value.startsWith(STORAGE_PREFIX) || (type === "gif" && GIF_HOSTS.test(value));
  if (!allowed(url) || !allowed(previewUrl)) return "invalid";

  return { type, url, previewUrl };
}

export async function startConversationAction(otherId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para enviar mensagens." };
  if (user.id === otherId) return { ok: false, error: "Você não pode conversar consigo mesmo." };

  const { data, error } = await supabase.rpc("get_or_create_conversation", { p_other: otherId });
  if (error || !data) {
    return { ok: false, error: "Não foi possível abrir a conversa." };
  }

  redirect(`/messages/${data}`);
}

export async function createGroupAction(
  title: string,
  memberIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const cleanTitle = title.trim();
  const members = [...new Set(memberIds)].filter((id) => id && id !== user.id);

  if (cleanTitle.length < 1) return { ok: false, error: "Dê um nome ao grupo." };
  if (cleanTitle.length > 60) return { ok: false, error: "O nome do grupo pode ter até 60 caracteres." };
  if (members.length < 1) return { ok: false, error: "Escolha pelo menos uma pessoa." };
  if (members.length > 24) return { ok: false, error: "Um grupo pode ter até 25 pessoas." };

  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: cleanTitle,
    p_members: members,
  });

  if (error || !data) {
    if (/too_many_members/i.test(error?.message ?? "")) {
      return { ok: false, error: "Um grupo pode ter até 25 pessoas." };
    }
    return { ok: false, error: "Não foi possível criar o grupo." };
  }

  revalidatePath("/messages");
  redirect(`/messages/${data}`);
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
  attachment?: MessageAttachment | null,
  options?: { viewOnce?: boolean; expiresInMinutes?: number | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const trimmed = body.trim();
  const parsed = parseAttachment(attachment);
  if (parsed === "invalid") return { ok: false, error: "Anexo inválido." };
  if (!trimmed && !parsed) return { ok: false, error: "Escreva uma mensagem ou envie uma mídia." };
  if (trimmed.length > 4000) return { ok: false, error: "Mensagem muito longa (máx. 4000)." };

  const expiresIn = options?.expiresInMinutes;
  const expiresAt =
    typeof expiresIn === "number" && expiresIn > 0
      ? new Date(Date.now() + Math.min(expiresIn, 60 * 24 * 30) * 60000).toISOString()
      : null;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: trimmed,
    attachment_url: parsed?.url ?? null,
    attachment_preview_url: parsed?.previewUrl ?? null,
    attachment_type: parsed?.type ?? null,
    view_once: Boolean(options?.viewOnce),
    expires_at: expiresAt,
  });

  if (error) {
    if (/rate limit|Muitas ações/i.test(error.message)) {
      return { ok: false, error: "Calma! Você enviou muitas mensagens em pouco tempo." };
    }
    if (/row-level security|permission denied/i.test(error.message)) {
      return { ok: false, error: "Você não participa mais desta conversa." };
    }
    return { ok: false, error: "Não foi possível enviar a mensagem." };
  }

  revalidatePath("/messages");
  return { ok: true };
}

export type OpenedMessage = {
  body: string;
  attachmentUrl: string | null;
  attachmentType: "image" | "gif" | "audio" | null;
};

/** Abre uma mensagem de visualização única: o conteúdo é devolvido e apagado. */
export async function openViewOnceAction(
  messageId: string,
): Promise<{ ok: true; message: OpenedMessage } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data, error } = await supabase.rpc("open_view_once_message", { p_message: messageId });
  if (error) return { ok: false, error: "Essa mensagem não existe mais." };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: false, error: "Essa mensagem não existe mais." };

  const opened: OpenedMessage = {
    body: row.body ?? "",
    attachmentUrl: row.attachment_url ?? null,
    attachmentType: (row.attachment_type as OpenedMessage["attachmentType"]) ?? null,
  };

  return { ok: true, message: opened };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}

export async function addGroupMembersAction(
  conversationId: string,
  memberIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const members = [...new Set(memberIds)].filter((id) => id && id !== user.id);
  if (members.length === 0) return { ok: false, error: "Escolha quem adicionar." };

  const { error } = await supabase.rpc("add_group_members", {
    p_conversation: conversationId,
    p_members: members,
  });

  if (error) {
    if (/too_many_members/i.test(error.message)) {
      return { ok: false, error: "O grupo chegou ao limite de 25 pessoas." };
    }
    if (/not_allowed|permission/i.test(error.message)) {
      return { ok: false, error: "Só quem criou o grupo pode adicionar pessoas." };
    }
    return { ok: false, error: "Não foi possível adicionar ao grupo." };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true, message: "Adicionado ao grupo." };
}

export async function renameGroupAction(
  conversationId: string,
  title: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const cleanTitle = title.trim();
  if (cleanTitle.length < 1) return { ok: false, error: "O nome não pode ficar vazio." };
  if (cleanTitle.length > 60) return { ok: false, error: "Máximo de 60 caracteres." };

  const { error } = await supabase.rpc("rename_group_conversation", {
    p_conversation: conversationId,
    p_title: cleanTitle,
  });

  if (error) {
    if (/not_allowed|privilege/i.test(error.message)) {
      return { ok: false, error: "Só quem criou o grupo pode renomear." };
    }
    return { ok: false, error: "Não foi possível renomear o grupo." };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true, message: "Grupo renomeado." };
}

export async function leaveGroupAction(conversationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase.rpc("leave_group_conversation", {
    p_conversation: conversationId,
  });
  if (error) return { ok: false, error: "Não foi possível sair do grupo." };

  revalidatePath("/messages");
  redirect("/messages");
}
