"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  return supabase;
}

export async function setUserVerifiedAction(
  userId: string,
  verified: boolean,
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(userId)) return { ok: false, error: "Usuário inválido." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_verified: verified })
    .eq("id", userId);

  if (error) return { ok: false, error: "Não foi possível atualizar a verificação." };

  revalidatePath("/admin");
  return { ok: true, message: verified ? "Conta verificada." : "Selo removido." };
}

export async function resolveReportAction(
  reportId: string,
  status: "reviewed" | "dismissed",
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(reportId)) return { ok: false, error: "Denúncia inválida." };

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) return { ok: false, error: "Não foi possível atualizar a denúncia." };

  revalidatePath("/admin");
  return { ok: true, message: status === "reviewed" ? "Denúncia revisada." : "Denúncia dispensada." };
}

export async function markFeedbackReadAction(feedbackId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(feedbackId)) return { ok: false, error: "Feedback inválido." };

  const { error } = await supabase
    .from("feedback")
    .update({ status: "read" })
    .eq("id", feedbackId);

  if (error) return { ok: false, error: "Não foi possível marcar como lido." };

  revalidatePath("/admin");
  return { ok: true };
}
