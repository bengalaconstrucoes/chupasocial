"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

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

export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Escreva uma mensagem." };
  if (trimmed.length > 4000) return { ok: false, error: "Mensagem muito longa (máx. 4000)." };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: trimmed,
  });

  if (error) {
    if (/rate limit|Muitas ações/i.test(error.message)) {
      return { ok: false, error: "Calma! Você enviou muitas mensagens em pouco tempo." };
    }
    return { ok: false, error: "Não foi possível enviar a mensagem." };
  }

  revalidatePath("/messages");
  return { ok: true };
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
