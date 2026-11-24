"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

function fail(message: string): ActionResult {
  return { ok: false, error: message };
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

  const content = String(formData.get("content") ?? "").trim();
  const communityId = String(formData.get("community_id") ?? "") || null;
  const mediaRaw = String(formData.get("media") ?? "[]");

  let media: Array<{ path: string; url: string }> = [];
  try {
    const parsed = JSON.parse(mediaRaw);
    if (Array.isArray(parsed)) {
      media = parsed
        .filter((item) => item && typeof item.path === "string" && typeof item.url === "string")
        .slice(0, 4);
    }
  } catch {
    return fail("Não conseguimos ler as imagens enviadas.");
  }

  if (content.length > 2000) return fail("O texto pode ter no máximo 2000 caracteres.");
  if (!content && media.length === 0) return fail("Escreva algo ou adicione uma imagem.");
  if (media.some((item) => !item.path.startsWith(`${user.id}/`))) {
    return fail("Imagem inválida para esta conta.");
  }

  if (communityId) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("user_id")
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return fail("Entre na comunidade para publicar nela.");
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content, community_id: communityId })
    .select("id")
    .single();

  if (error || !post) return fail(translate(error ?? { message: "" }));

  if (media.length > 0) {
    const { error: mediaError } = await supabase.from("post_media").insert(
      media.map((item, index) => ({
        post_id: post.id,
        storage_path: item.path,
        public_url: item.url,
        position: index,
      })),
    );

    if (mediaError) {
      await supabase.from("posts").delete().eq("id", post.id);
      return fail("Não foi possível anexar as imagens. Tente de novo.");
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
  if (!trimmed) return fail("A publicação não pode ficar vazia.");
  if (trimmed.length > 2000) return fail("Máximo de 2000 caracteres.");

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

  const trimmed = content.trim();
  if (!trimmed) return fail("Escreva um comentário.");
  if (trimmed.length > 1000) return fail("O comentário pode ter no máximo 1000 caracteres.");

  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.post_id !== postId) return fail("Não foi possível responder aqui.");
  }

  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: user.id, content: trimmed, parent_id: parentId });

  if (error) return fail(translate(error));

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou.");

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return fail(translate(error));

  revalidatePath("/");
  return { ok: true };
}
