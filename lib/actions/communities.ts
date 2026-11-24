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
    .insert({ name, description, image_url: imageUrl, slug, creator_id: user.id })
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
    .select("slug")
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
    const { error } = await supabase
      .from("community_members")
      .insert({ community_id: communityId, user_id: user.id, role: "member" });
    if (error) return { ok: false, error: "Não foi possível entrar na comunidade." };
    revalidatePath(`/communities/${community.slug}`);
    revalidatePath("/communities");
    return { ok: true, message: "Você entrou na comunidade." };
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
    .update({ name, description, image_url: imageUrl })
    .eq("id", communityId);

  if (error) return { ok: false, error: "Não foi possível salvar as alterações." };

  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/communities");
  return { ok: true, message: "Comunidade atualizada." };
}
