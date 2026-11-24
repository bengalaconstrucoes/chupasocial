"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) return { ok: false, error: "Não foi possível marcar como lidas." };
  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true };
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível atualizar a notificação." };
  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true };
}

export async function clearNotificationsAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "Não foi possível limpar as notificações." };
  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true };
}
