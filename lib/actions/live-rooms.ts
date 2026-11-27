"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createLiveRoomAction(
  communityId: string,
  title: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!UUID.test(communityId)) return { ok: false, error: "Comunidade inválida." };

  const clean = title.trim();
  if (clean.length < 3) return { ok: false, error: "Dê um título para a sala." };
  if (clean.length > 80) return { ok: false, error: "O título pode ter até 80 caracteres." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) return { ok: false, error: "Comunidade não encontrada." };

  const { error } = await supabase.from("live_rooms").insert({
    community_id: communityId,
    host_id: user.id,
    title: clean,
  });

  if (error) return { ok: false, error: "Não foi possível abrir a sala." };

  revalidatePath(`/communities/${community.slug}`);
  return { ok: true, message: "Sala aberta." };
}

export async function endLiveRoomAction(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };
  if (!UUID.test(roomId)) return { ok: false, error: "Sala inválida." };

  const { data: room } = await supabase
    .from("live_rooms")
    .select("id, community:communities(slug)")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return { ok: false, error: "Sala não encontrada." };

  const { error } = await supabase
    .from("live_rooms")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", roomId);

  if (error) return { ok: false, error: "Não foi possível encerrar a sala." };

  const slug = (room as any).community?.slug;
  if (slug) revalidatePath(`/communities/${slug}`);
  return { ok: true, message: "Sala encerrada." };
}
