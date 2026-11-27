"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function createCommunityAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para criar uma comunidade." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const bannerUrl = String(formData.get("banner_url") ?? "").trim() || null;
  const bannerFocus = clampFocus(formData.get("banner_focus"));
  let slug = slugify(String(formData.get("slug") ?? "") || name);

  if (name.length < 3) return { ok: false, error: "O nome precisa ter ao menos 3 caracteres." };
  if (name.length > 60) return { ok: false, error: "O nome pode ter até 60 caracteres." };
  if (description.length > 500) return { ok: false, error: "A descrição pode ter até 500." };
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) {
    return { ok: false, error: "O endereço deve ter 3–32 caracteres (letras, números, hífen)." };
  }

  const { data: existing } = await supabase
    .from("communities")
    .select("id")
    .ilike("slug", slug)
    .maybeSingle();

  if (existing) slug = `${slug.slice(0, 26)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from("communities")
    .insert({
      name,
      description,
      image_url: imageUrl,
      banner_url: bannerUrl,
      banner_focus: bannerFocus,
      slug,
      creator_id: user.id,
    })
    .select("slug")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível criar a comunidade." };

  revalidatePath("/communities");
  redirect(`/communities/${data.slug}`);
}

export async function toggleCommunityMembershipAction(
  communityId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para participar." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug, requires_approval")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) return { ok: false, error: "Comunidade não encontrada." };

  const { data: membership } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    const needsApproval = Boolean((community as any).requires_approval);
    const { error } = await supabase.from("community_members").insert({
      community_id: communityId,
      user_id: user.id,
      role: "member",
      status: needsApproval ? "pending" : "active",
    });
    if (error) return { ok: false, error: "Não foi possível entrar na comunidade." };
    revalidatePath(`/communities/${community.slug}`);
    revalidatePath("/communities");
    return {
      ok: true,
      message: needsApproval
        ? "Pedido enviado. Aguarde a aprovação de um administrador."
        : "Você entrou na comunidade.",
    };
  }

  if (membership.role === "owner") {
    return { ok: false, error: "O dono não pode sair da própria comunidade." };
  }

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível sair da comunidade." };

  revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/communities");
  return { ok: true, message: "Você saiu da comunidade." };
}

export async function updateMemberRoleAction(
  communityId: string,
  memberId: string,
  role: "moderator" | "member",
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data: mine } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mine || (mine.role !== "owner" && mine.role !== "moderator")) {
    return { ok: false, error: "Apenas administradores podem mudar papéis." };
  }

  const { error } = await supabase
    .from("community_members")
    .update({ role })
    .eq("community_id", communityId)
    .eq("user_id", memberId)
    .neq("role", "owner");

  if (error) return { ok: false, error: "Não foi possível atualizar o papel." };

  revalidatePath("/communities");
  return { ok: true, message: "Papel atualizado." };
}

export async function removeMemberAction(
  communityId: string,
  memberId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", memberId)
    .neq("role", "owner");

  if (error) return { ok: false, error: "Não foi possível remover o membro." };

  revalidatePath("/communities");
  return { ok: true, message: "Membro removido." };
}

export async function updateCommunityAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const communityId = String(formData.get("community_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const bannerUrl = String(formData.get("banner_url") ?? "").trim() || null;
  const bannerFocus = clampFocus(formData.get("banner_focus"));

  if (!communityId) return { ok: false, error: "Comunidade inválida." };
  if (name.length < 3 || name.length > 60) return { ok: false, error: "Nome inválido." };
  if (description.length > 500) return { ok: false, error: "Descrição muito longa." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", communityId)
    .maybeSingle();

  const { error } = await supabase
    .from("communities")
    .update({
      name,
      description,
      image_url: imageUrl,
      banner_url: bannerUrl,
      banner_focus: bannerFocus,
    })
    .eq("id", communityId);

  if (error) return { ok: false, error: "Não foi possível salvar as alterações." };

  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/communities");
  return { ok: true, message: "Comunidade atualizada." };
}

export async function approveMemberAction(
  communityId: string,
  memberId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug, name")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) return { ok: false, error: "Comunidade não encontrada." };

  const { error } = await supabase
    .from("community_members")
    .update({ status: "active" })
    .eq("community_id", communityId)
    .eq("user_id", memberId)
    .eq("status", "pending");

  if (error) return { ok: false, error: "Não foi possível aprovar o membro." };

  await supabase.from("notifications").insert({
    user_id: memberId,
    actor_id: user.id,
    type: "community",
    community_id: communityId,
  });

  revalidatePath(`/communities/${community.slug}`);
  revalidatePath(`/communities/${community.slug}/settings`);
  return { ok: true, message: "Membro aprovado." };
}

export async function declineMemberAction(
  communityId: string,
  memberId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", communityId)
    .maybeSingle();

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", memberId)
    .eq("status", "pending");

  if (error) return { ok: false, error: "Não foi possível recusar o pedido." };

  if (community?.slug) {
    revalidatePath(`/communities/${community.slug}`);
    revalidatePath(`/communities/${community.slug}/settings`);
  }
  return { ok: true, message: "Pedido recusado." };
}

function clampFocus(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export async function updateCommunityExtrasAction(
  communityId: string,
  requiresApproval: boolean,
  emojis: string[],
  isPrivate = false,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const clean = [...new Set(emojis.map((emoji) => emoji.trim()).filter(Boolean))].slice(0, 12);
  if (clean.some((emoji) => emoji.length > 8)) {
    return { ok: false, error: "Cada emoji pode ter até 8 caracteres." };
  }

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", communityId)
    .maybeSingle();

  const { error } = await supabase
    .from("communities")
    .update({ requires_approval: requiresApproval, emojis: clean, is_private: isPrivate })
    .eq("id", communityId);

  if (error) return { ok: false, error: "Não foi possível salvar as preferências." };

  if (community?.slug) {
    revalidatePath(`/communities/${community.slug}`);
    revalidatePath(`/communities/${community.slug}/settings`);
  }
  return { ok: true, message: "Preferências salvas." };
}

export async function regenerateInviteAction(communityId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const token = replaceToken();
  const { error } = await supabase
    .from("communities")
    .update({ invite_token: token })
    .eq("id", communityId);

  if (error) return { ok: false, error: "Não foi possível gerar um novo convite." };

  revalidatePath("/communities");
  return { ok: true, message: "Novo link de convite gerado." };
}

function replaceToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export async function joinCommunityByTokenAction(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para aceitar o convite." };

  const clean = token.trim();
  if (!/^[a-z0-9]{8,40}$/i.test(clean)) return { ok: false, error: "Convite inválido." };

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, requires_approval")
    .eq("invite_token", clean)
    .maybeSingle();
  if (!community) return { ok: false, error: "Este convite não existe mais." };

  const { data: existing } = await supabase
    .from("community_members")
    .select("user_id, status")
    .eq("community_id", community.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      message: existing.status === "pending" ? "Seu pedido já está aguardando aprovação." : "Você já está nesta comunidade.",
    };
  }

  const needsApproval = Boolean((community as any).requires_approval);
  const { error } = await supabase.from("community_members").insert({
    community_id: community.id,
    user_id: user.id,
    role: "member",
    status: needsApproval ? "pending" : "active",
  });
  if (error) return { ok: false, error: "Não foi possível entrar na comunidade." };

  revalidatePath(`/communities/${community.slug}`);
  return {
    ok: true,
    message: needsApproval
      ? "Pedido enviado. Aguarde aprovação."
      : "Você entrou na comunidade pelo convite.",
  };
}
