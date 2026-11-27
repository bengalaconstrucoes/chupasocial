"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function setBlockAction(targetId: string, block: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (user.id === targetId) return { ok: false, error: "Você não pode bloquear a si mesmo." };

  const { data: target } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Perfil não encontrado." };

  if (block) {
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: targetId });
    if (error && !/duplicate key|23505/i.test(error.message)) {
      return { ok: false, error: "Não foi possível bloquear agora." };
    }

    // Bloquear encerra a relação nos dois sentidos.
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", targetId)
      .eq("following_id", user.id);
  } else {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetId);
    if (error) return { ok: false, error: "Não foi possível desbloquear agora." };
  }

  revalidatePath("/");
  revalidatePath(`/u/${target.username}`);
  revalidatePath("/settings");
  return { ok: true, message: block ? "Perfil bloqueado." : "Perfil desbloqueado." };
}
