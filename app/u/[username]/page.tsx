import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FeedList } from "@/components/feed-list";
import { ProfileHeader, ProfileLocked } from "@/components/profile-header";
import {
  fetchFeed,
  fetchFollowState,
  fetchProfileStats,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function load(username: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_profile_by_username", {
    p_username: username.toLowerCase(),
  });
  const profile = (Array.isArray(data) ? data[0] : null) as Profile | null;

  return { profile, viewer: user };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { profile } = await load(username);
  if (!profile) return { title: "Perfil não encontrado" };
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio || `Perfil de ${profile.display_name} no ChupaSocial.`,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, viewer } = await load(username);

  if (!viewer) redirect(`/login?next=/u/${username}`);
  if (!profile) notFound();

  const isOwner = viewer.id === profile.id;
  const [stats, followState, posts] = await Promise.all([
    fetchProfileStats(profile.id),
    fetchFollowState(viewer.id, profile.id),
    fetchFeed({ mode: "profile", profileId: profile.id, viewerId: viewer.id, limit: 12 }),
  ]);

  const locked =
    profile.is_private && !isOwner && !followState.following;

  return (
    <AppShell>
      <ProfileHeader
        profile={profile}
        stats={stats}
        viewerId={viewer.id}
        followState={followState}
        isOwner={isOwner}
      />

      {profile.is_private && !isOwner && !followState.following ? (
        followState.requested ? (
          <div className="border-b border-line bg-surface px-6 py-14 text-center">
            <h2 className="text-lg font-semibold">Solicitação enviada</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Aguardando @{profile.username} aceitar. Você será notificado quando isso acontecer.
            </p>
          </div>
        ) : (
          <ProfileLocked profile={profile} />
        )
      ) : (
        <FeedList
          initialPosts={posts}
          viewerId={viewer.id}
          mode="profile"
          profileId={profile.id}
          emptyTitle={isOwner ? "Você ainda não publicou nada" : "Nenhuma publicação por aqui"}
          emptyDescription={
            isOwner
              ? "Volte ao início e conte o que está acontecendo. Sua primeira publicação aparece aqui."
              : `Quando @${profile.username} publicar algo, aparece aqui.`
          }
        />
      )}
    </AppShell>
  );
}
