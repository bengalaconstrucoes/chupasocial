"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "hate",
  "nudity",
  "violence",
  "misinformation",
  "other",
]);

function fail(error: string): ActionResult {
  return { ok: false, error };
}

export async function toggleSaveAction(
  postId: string,
  save: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");
  if (!UUID.test(postId)) return fail("Publicação inválida.");

  if (save) {
    const { error } = await supabase
      .from("saved_posts")
      .insert({ user_id: user.id, post_id: postId });
    if (error && !/duplicate key/i.test(error.message)) {
      return fail("Não foi possível salvar a publicação.");
    }
  } else {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);
    if (error) return fail("Não foi possível remover dos salvos.");
  }

  revalidatePath("/saved");
  return { ok: true };
}

export async function reportAction(input: {
  targetType: "post" | "message" | "profile";
  targetId: string;
  reason: string;
  details?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");
  if (!["post", "message", "profile"].includes(input.targetType)) return fail("Alvo inválido.");
  if (!UUID.test(input.targetId)) return fail("Conteúdo inválido.");
  if (!REPORT_REASONS.has(input.reason)) return fail("Escolha um motivo.");
  if (input.targetType === "profile" && input.targetId === user.id) {
    return fail("Você não pode denunciar a si mesmo.");
  }

  const details = (input.details ?? "").trim();
  if (details.length > 500) return fail("Detalhes muito longos.");

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: details || null,
  });

  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return fail("Você já denunciou este conteúdo.");
    }
    return fail("Não foi possível registrar a denúncia.");
  }

  return { ok: true, message: "Denúncia registrada. Obrigado por avisar." };
}

export async function togglePinnedPostAction(postId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  if (postId) {
    if (!UUID.test(postId)) return fail("Publicação inválida.");
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, root_post_id, repost_of")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.author_id !== user.id) return fail("Só dá para fixar publicações suas.");
    if (post.root_post_id || post.repost_of) {
      return fail("Fixe apenas publicações originais suas.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ pinned_post_id: postId })
    .eq("id", user.id);
  if (error) return fail("Não foi possível alterar o post fixado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.username) revalidatePath(`/u/${profile.username}`);
  revalidatePath("/");
  return { ok: true, message: postId ? "Publicação fixada." : "Publicação desafixada." };
}

export async function votePollAction(
  postId: string,
  optionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");
  if (!UUID.test(postId) || !UUID.test(optionId)) return fail("Enquete inválida.");

  const { data: option } = await supabase
    .from("poll_options")
    .select("id, post_id")
    .eq("id", optionId)
    .maybeSingle();
  if (!option || option.post_id !== postId) return fail("Opção inválida.");

  const { error } = await supabase
    .from("poll_votes")
    .upsert(
      { post_id: postId, option_id: optionId, user_id: user.id },
      { onConflict: "post_id,user_id" },
    );
  if (error) return fail("Não foi possível registrar seu voto.");

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export type PollState = {
  options: Array<{ id: string; label: string; count: number }>;
  myVote: string | null;
  total: number;
};

export async function getPollAction(
  postId: string,
): Promise<PollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: options }, { data: votes }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, label, position")
      .eq("post_id", postId)
      .order("position", { ascending: true }),
    supabase.from("poll_votes").select("option_id, user_id").eq("post_id", postId),
  ]);

  const counts = new Map<string, number>();
  let myVote: string | null = null;
  for (const vote of votes ?? []) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    if (user && vote.user_id === user.id) myVote = vote.option_id;
  }

  const list = (options ?? []).map((option: any) => ({
    id: option.id as string,
    label: option.label as string,
    count: counts.get(option.id) ?? 0,
  }));

  return {
    options: list,
    myVote,
    total: list.reduce((sum, option) => sum + option.count, 0),
  };
}

export async function markProfileVisitsSeenAction(): Promise<ActionResult> {
  return { ok: true };
}
