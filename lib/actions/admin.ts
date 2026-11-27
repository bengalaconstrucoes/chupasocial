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
  return { supabase, userId: user.id };
}

export async function setUserVerifiedAction(
  userId: string,
  verified: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(userId)) return { ok: false, error: "Usuário inválido." };

  const { error } = await admin.supabase
    .from("profiles")
    .update({ is_verified: verified })
    .eq("id", userId);

  if (error) return { ok: false, error: "Não foi possível atualizar a verificação." };

  revalidatePath("/admin");
  return { ok: true, message: verified ? "Conta verificada." : "Selo removido." };
}

export async function setUserAdminAction(
  userId: string,
  isAdmin: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(userId)) return { ok: false, error: "Usuário inválido." };
  if (userId === admin.userId) {
    return { ok: false, error: "Você não pode remover o seu próprio acesso de administrador." };
  }

  const { error } = await admin.supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return { ok: false, error: "Não foi possível atualizar o acesso de administrador." };

  revalidatePath("/admin");
  return {
    ok: true,
    message: isAdmin ? "Agora essa conta é administradora." : "Acesso de administrador removido.",
  };
}

export async function resolveReportAction(
  reportId: string,
  status: "reviewed" | "dismissed",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(reportId)) return { ok: false, error: "Denúncia inválida." };

  const { error } = await admin.supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) return { ok: false, error: "Não foi possível atualizar a denúncia." };

  revalidatePath("/admin");
  return { ok: true, message: status === "reviewed" ? "Denúncia revisada." : "Denúncia dispensada." };
}

export async function setPostHiddenAction(
  postId: string,
  hidden: boolean,
  reason?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(postId)) return { ok: false, error: "Publicação inválida." };

  const { error } = await admin.supabase
    .from("posts")
    .update({
      hidden_at: hidden ? new Date().toISOString() : null,
      hidden_reason: hidden ? (reason ?? "moderação").slice(0, 200) : null,
    })
    .eq("id", postId);

  if (error) return { ok: false, error: "Não foi possível alterar a publicação." };

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: hidden ? "Publicação ocultada." : "Publicação restaurada." };
}

export async function setUserMutedAction(
  userId: string,
  minutes: number,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(userId)) return { ok: false, error: "Usuário inválido." };

  const { error } = await admin.supabase.rpc("set_user_muted", {
    p_user: userId,
    p_minutes: minutes,
  });

  if (error) return { ok: false, error: "Não foi possível alterar o silêncio da conta." };

  revalidatePath("/admin");
  return {
    ok: true,
    message: minutes > 0 ? `Conta silenciada por ${minutes} minutos.` : "Silêncio removido.",
  };
}

export async function markFeedbackReadAction(feedbackId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Apenas administradores podem fazer isso." };
  if (!UUID.test(feedbackId)) return { ok: false, error: "Feedback inválido." };

  const { error } = await admin.supabase
    .from("feedback")
    .update({ status: "read" })
    .eq("id", feedbackId);

  if (error) return { ok: false, error: "Não foi possível marcar como lido." };

  revalidatePath("/admin");
  return { ok: true };
}
