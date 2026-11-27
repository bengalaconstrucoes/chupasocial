import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CommunityForm } from "@/components/community-form";
import { CommunityMembersAdmin } from "@/components/community-members-admin";
import { CommunityExtras } from "@/components/community-extras";
import { fetchCommunityBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CommunitySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/communities/${slug}/settings`);

  const community = await fetchCommunityBySlug(slug, user.id);
  if (!community) notFound();

  if (community.my_role !== "owner" && community.my_role !== "moderator") {
    return (
      <AppShell>
        <div className="px-5 py-16 text-center">
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted">Apenas donos e moderadores podem gerenciar esta comunidade.</p>
          <Link href={`/communities/${community.slug}`} className="btn btn-ghost mt-4">
            Voltar para a comunidade
          </Link>
        </div>
      </AppShell>
    );
  }

  const [{ data: memberRows }, { data: pendingRows }] = await Promise.all([
    supabase
      .from("community_members")
      .select("role, status, joined_at, user:profiles!community_members_user_id_fkey(*)")
      .eq("community_id", community.id)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(100),
    supabase
      .from("community_members")
      .select("role, status, joined_at, user:profiles!community_members_user_id_fkey(*)")
      .eq("community_id", community.id)
      .eq("status", "pending")
      .order("joined_at", { ascending: true })
      .limit(100),
  ]);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <Link href={`/communities/${community.slug}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> {community.name}
        </Link>
        <h1 className="mt-2 text-base font-semibold">Gerenciar comunidade</h1>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Informações</h2>
          <div className="chupa-card p-4">
            <CommunityForm mode="edit" community={community} userId={user.id} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Acesso e convites</h2>
          <div className="chupa-card p-4">
            <CommunityExtras
              communityId={community.id}
              requiresApproval={Boolean(community.requires_approval)}
              emojis={community.emojis ?? []}
              inviteToken={community.invite_token ?? ""}
              pendingMembers={((pendingRows ?? []) as any[])
                .filter((row) => row.user)
                .map((row) => ({ user: row.user, joined_at: row.joined_at }))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Membros ({memberRows?.length ?? 0})</h2>
          <CommunityMembersAdmin
            communityId={community.id}
            members={(memberRows ?? []) as any}
            viewerRole={community.my_role ?? null}
          />
        </section>
      </div>
    </AppShell>
  );
}
