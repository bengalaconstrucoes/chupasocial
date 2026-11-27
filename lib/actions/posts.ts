"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractMentions } from "@/lib/hashtags";
import { screenContent } from "@/lib/moderation";
import type { ActionResult } from "@/lib/types";

async function isMuted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("muted_until")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.muted_until && new Date(data.muted_until).getTime() > Date.now());
}

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

/** Suspensão: a pessoa continua lendo, mas não publica nem responde. */
async function suspensionMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("suspended_until")
    .eq("id", userId)
    .maybeSingle();
  const until = data?.suspended_until as string | null | undefined;
  if (!until || new Date(until).getTime() <= Date.now()) return null;
  return `Sua conta está suspensa até ${new Date(until).toLocaleDateString(
    "pt-BR",
  )}. Você pode ler, mas não publicar.`;
}

function translate(error: { message: string }): string {
  if (/rate limit|Muitas ações/i.test(error.message)) {
    return "Você está publicando rápido demais. Aguarde alguns instantes.";
  }
  if (/row-level security|permission denied/i.test(error.message)) {
    return "Você não tem permissão para essa ação.";
  }
  if (/could not find|does not exist/i.test(error.message)) {
    return "O conteúdo não existe mais.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

export async function createPostAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");
  if (await isMuted(supabase, user.id)) {
    return fail("Sua conta está silenciada pela moderação por enquanto.");
  }
  const suspended = await suspensionMessage(supabase, user.id);
  if (suspended) return fail(suspended);

  const content = String(formData.get("content") ?? "").trim();
  const communityId = String(formData.get("community_id") ?? "") || null;
  const mediaRaw = String(formData.get("media") ?? "[]");
  const pollRaw = String(formData.get("poll") ?? "");
  const collaboratorsRaw = String(formData.get("collaborators") ?? "");

  let media: Array<{ path: string; url: string; type: string }> = [];
  try {
    const parsed = JSON.parse(mediaRaw);
    if (Array.isArray(parsed)) {
      media = parsed
        .filter((item) => item && typeof item.path === "string" && typeof item.url === "string")
        .map((item) => ({
          path: item.path as string,
          url: item.url as string,
          type: item.type === "video" ? "video" : item.type === "gif" ? "gif" : "image",
        }))
        .slice(0, 4);
    }
  } catch {
    return fail("Não conseguimos ler as mídias enviadas.");
  }

  let poll: string[] = [];
  if (pollRaw) {
    try {
      const parsed = JSON.parse(pollRaw);
      if (Array.isArray(parsed)) {
        poll = parsed
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0 && item.length <= 60)
          .slice(0, 4);
      }
    } catch {
      return fail("Enquete inválida.");
    }
    if (poll.length < 2) return fail("Uma enquete precisa de pelo menos duas opções.");
  }

  const collaboratorNames = [
    ...new Set(
      collaboratorsRaw
        .replace(/,/g, " ")
        .split(/\s+/)
        .map((name) => name.replace(/^@/, "").toLowerCase())
        .filter((name) => /^[a-z0-9_]{3,20}$/.test(name)),
    ),
  ].slice(0, 3);

  if (content.length > 2000) return fail("O texto pode ter no máximo 2000 caracteres.");

  const screening = screenContent(content);
  if (screening.blocked) return fail(screening.reason ?? "Esse conteúdo não é permitido.");
  if (!content && media.length === 0 && poll.length === 0) {
    return fail("Escreva algo, adicione uma mídia ou crie uma enquete.");
  }
  if (media.some((item) => !item.path.startsWith(`${user.id}/`))) {
    return fail("Imagem inválida para esta conta.");
  }

  if (communityId) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("user_id")
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return fail("Entre na comunidade para publicar nela.");

    const { data: community } = await supabase
      .from("communities")
      .select("is_private")
      .eq("id", communityId)
      .maybeSingle();
    if (community?.is_private) {
      const { data: activeMembership } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!activeMembership) return fail("Esta comunidade é privada.");
    }
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content, community_id: communityId })
    .select("id")
    .single();

  if (error || !post) return fail(translate(error ?? { message: "" }));

  if (screening.flags.length > 0) {
    await supabase
      .from("moderation_flags")
      .insert(
        screening.flags.map((flag) => ({
          post_id: post.id,
          reason: flag.reason,
          severity: flag.severity,
        })),
      )
      .then(() => undefined, () => undefined);
  }

  const mentions = extractMentions(content);
  if (mentions.length > 0) {
    await supabase
      .rpc("notify_mentions", { p_post: post.id, p_usernames: mentions })
      .then(() => undefined, () => undefined);
  }

  if (media.length > 0) {
    const { error: mediaError } = await supabase.from("post_media").insert(
      media.map((item, index) => ({
        post_id: post.id,
        storage_path: item.path,
        public_url: item.url,
        position: index,
        media_type: item.type,
      })),
    );

    if (mediaError) {
      await supabase.from("posts").delete().eq("id", post.id);
      return fail("Não foi possível anexar a mídia. Tente de novo.");
    }
  }

  if (poll.length >= 2) {
    const { error: pollError } = await supabase.from("polls").insert({ post_id: post.id });
    if (!pollError) {
      const { error: optionError } = await supabase.from("poll_options").insert(
        poll.map((label, index) => ({ post_id: post.id, label, position: index })),
      );
      if (optionError) {
        await supabase.from("polls").delete().eq("post_id", post.id);
      }
    }
  }

  if (collaboratorNames.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, username")
      .in("username", collaboratorNames)
      .neq("id", user.id);

    const rows = (people ?? []).map((person: any) => ({
      post_id: post.id,
      user_id: person.id as string,
    }));
    if (rows.length > 0) {
      await supabase.from("post_collaborators").insert(rows);
    }
  }

  revalidatePath("/");
  revalidatePath("/search");
  if (communityId) {
    const { data: community } = await supabase
      .from("communities")
      .select("slug")
      .eq("id", communityId)
      .maybeSingle();
    if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  }

  return { ok: true, message: "Publicado!" };
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  const { data: media } = await supabase
    .from("post_media")
    .select("storage_path")
    .eq("post_id", postId);

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return fail(translate(error));

  if (media && media.length > 0) {
    await supabase.storage.from("post-media").remove(media.map((row) => row.storage_path));
  }

  revalidatePath("/");
  return { ok: true };
}

export async function updatePostAction(postId: string, content: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  const trimmed = content.trim();
  if (trimmed.length > 2000) return fail("Máximo de 2000 caracteres.");
  if (!trimmed) {
    const { count } = await supabase
      .from("post_media")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (!count) return fail("A publicação não pode ficar vazia.");
  }

  const { error } = await supabase
    .from("posts")
    .update({ content: trimmed, edited_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) return fail(translate(error));

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function toggleLikeAction(postId: string, liked: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  if (liked) {
    const { error } = await supabase
      .from("likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error && !/duplicate key/i.test(error.message)) return fail(translate(error));
  } else {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return fail(translate(error));
  }

  return { ok: true };
}

export async function toggleRepostAction(postId: string, reposted: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  if (reposted) {
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", user.id)
      .eq("repost_of", postId)
      .maybeSingle();

    if (existing) {
      await supabase.from("posts").delete().eq("id", existing.id);
    } else {
      const { error } = await supabase
        .from("posts")
        .insert({ author_id: user.id, repost_of: postId, content: "" });
      if (error) return fail(translate(error));
    }
  } else {
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("author_id", user.id)
      .eq("repost_of", postId);
    if (error) return fail(translate(error));
  }

  revalidatePath("/");
  return { ok: true };
}

export async function quoteRepostAction(postId: string, content: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  const trimmed = content.trim();
  if (!trimmed) return fail("Escreva algo para citar esta publicação.");
  if (trimmed.length > 2000) return fail("Máximo de 2000 caracteres.");

  const { data: original } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();
  if (!original) return fail("A publicação original não existe mais.");

  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("author_id", user.id)
    .eq("repost_of", postId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed, edited_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return fail(translate(error));
  } else {
    const { error } = await supabase
      .from("posts")
      .insert({ author_id: user.id, repost_of: postId, content: trimmed });
    if (error) return fail(translate(error));
  }

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true, message: "Citação publicada." };
}

export async function addCommentAction(
  postId: string,
  content: string,
  parentId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");
  if (await isMuted(supabase, user.id)) {
    return fail("Sua conta está silenciada pela moderação por enquanto.");
  }
  const suspended = await suspensionMessage(supabase, user.id);
  if (suspended) return fail(suspended);

  const trimmed = content.trim();
  if (!trimmed) return fail("Escreva uma resposta.");

  const screening = screenContent(trimmed);
  if (screening.blocked) return fail(screening.reason ?? "Esse conteúdo não é permitido.");
  if (trimmed.length > 1000) return fail("A resposta pode ter no máximo 1000 caracteres.");

  let rootId = postId;
  let parentPostId: string | null = null;

  if (parentId) {
    const { data: parent } = await supabase
      .from("posts")
      .select("id, root_post_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return fail("Não foi possível responder aqui.");
    rootId = (parent.root_post_id as string | null) ?? parent.id;
    parentPostId = parent.id;
  } else {
    const { data: root } = await supabase
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!root) return fail("A publicação não existe mais.");
  }

  const { data: created, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      content: trimmed,
      root_post_id: rootId,
      parent_post_id: parentPostId,
    })
    .select("id")
    .single();

  if (error || !created) return fail(translate(error ?? { message: "" }));

  const mentions = extractMentions(trimmed);
  if (mentions.length > 0) {
    await supabase
      .rpc("notify_mentions", { p_post: created.id, p_usernames: mentions })
      .then(() => undefined, () => undefined);
  }

  revalidatePath(`/post/${rootId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCommentAction(replyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  const { data: media } = await supabase
    .from("post_media")
    .select("storage_path")
    .eq("post_id", replyId);

  const { error } = await supabase.from("posts").delete().eq("id", replyId);
  if (error) return fail(translate(error));

  if (media && media.length > 0) {
    await supabase.storage.from("post-media").remove(media.map((row) => row.storage_path));
  }

  revalidatePath("/");
  return { ok: true };
}
