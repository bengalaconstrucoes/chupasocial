"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function toggleFollowAction(targetId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para seguir alguém." };
  if (user.id === targetId) return { ok: false, error: "Não é possível seguir você mesmo." };

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username, is_private")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) return { ok: false, error: "Perfil não encontrado." };

  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);
    if (error) return { ok: false, error: "Não foi possível deixar de seguir agora." };
    revalidatePath(`/u/${target.username}`);
    revalidatePath("/");
    return { ok: true, message: "Você deixou de seguir." };
  }

  const { data: request } = await supabase
    .from("follow_requests")
    .select("requester_id")
    .eq("requester_id", user.id)
    .eq("target_id", targetId)
    .maybeSingle();

  if (request) {
    await supabase
      .from("follow_requests")
      .delete()
      .eq("requester_id", user.id)
      .eq("target_id", targetId);
    revalidatePath(`/u/${target.username}`);
    return { ok: true, message: "Solicitação cancelada." };
  }

  if (target.is_private) {
    const { error } = await supabase
      .from("follow_requests")
      .insert({ requester_id: user.id, target_id: targetId });
    if (error) {
      if (/rate limit|Muitas ações/i.test(error.message)) {
        return { ok: false, error: "Muitas solicitações em pouco tempo. Aguarde." };
      }
      return { ok: false, error: "Não foi possível enviar a solicitação." };
    }
    revalidatePath(`/u/${target.username}`);
    return { ok: true, message: "Solicitação enviada." };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetId });

  if (error) {
    if (/rate limit|Muitas ações/i.test(error.message)) {
      return { ok: false, error: "Você está seguindo rápido demais. Aguarde um pouco." };
    }
    return { ok: false, error: "Não foi possível seguir agora." };
  }

  revalidatePath(`/u/${target.username}`);
  revalidatePath("/");
  return { ok: true, message: "Seguindo!" };
}

export async function respondFollowRequestAction(
  requesterId: string,
  accept: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase.rpc("respond_follow_request", {
    p_requester: requesterId,
    p_accept: accept,
  });

  if (error) return { ok: false, error: "Não foi possível responder à solicitação." };

  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true, message: accept ? "Solicitação aceita." : "Solicitação recusada." };
}
