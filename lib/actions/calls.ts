"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ringCallAction(
  conversationId: string,
  callId: string,
  mode: "audio" | "video",
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!UUID.test(conversationId) || !UUID.test(callId)) {
    return { ok: false, error: "Chamada inválida." };
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { ok: false, error: "Você não participa desta conversa." };

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const targets = (members ?? [])
    .map((row: any) => row.user_id as string)
    .filter((id) => id !== user.id);

  if (targets.length === 0) return { ok: false, error: "Não há mais ninguém nesta conversa." };
  if (targets.length > 24) return { ok: false, error: "Chamada em grupo limitada a 25 pessoas." };

  // Evita toques antigos acumulados no mesmo aparelho.
  await supabase
    .from("call_rings")
    .delete()
    .eq("from_user", user.id)
    .lt("created_at", new Date(Date.now() - 30000).toISOString());

  const { error } = await supabase.from("call_rings").insert(
    targets.map((toUser) => ({
      call_id: callId,
      conversation_id: conversationId,
      from_user: user.id,
      to_user: toUser,
      mode,
    })),
  );

  if (error) return { ok: false, error: "Não foi possível tocar no aparelho da outra pessoa." };
  return { ok: true };
}

export async function dismissCallRingAction(callId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!UUID.test(callId)) return { ok: false, error: "Chamada inválida." };

  await supabase
    .from("call_rings")
    .update({ dismissed: true })
    .eq("call_id", callId)
    .eq("to_user", user.id);

  return { ok: true };
}
