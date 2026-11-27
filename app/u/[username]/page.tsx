import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Ban, UserX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FeedList } from "@/components/feed-list";
import { ProfileHeader, ProfileLocked } from "@/components/profile-header";
import { ProfileAccent } from "@/components/profile-accent";
import { ProfileAlbum } from "@/components/album";
import {
  fetchAchievementCounts,
  fetchAlbum,
  fetchFeed,
  fetchFollowState,
  fetchPostById,
  fetchProfileStats,
  fetchProfileVisits,
} from "@/lib/queries";
import { profileAccentStyle } from "@/lib/profile-style";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type Relationship = "none" | "blocking" | "blocked";

async function load(username: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_profile_by_username", {
    p_username: username.toLowerCase(),
  });
  const profile = (Array.isArray(data) ? data[0] : null) as Profile | null;

  return { profile, viewer: user, supabase };
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
  const { profile, viewer, supabase } = await load(username);

  if (!viewer) redirect(`/login?next=/u/${username}`);
  if (!profile) notFound();

  const isOwner = viewer.id === profile.id;
  const [stats, followState, posts, blockData, album, achievements] = await Promise.all([
    fetchProfileStats(profile.id),
    fetchFollowState(viewer.id, profile.id),
    fetchFeed({ mode: "profile", profileId: profile.id, viewerId: viewer.id, limit: 12 }),
    isOwner ? Promise.resolve({ data: "none" }) : supabase.rpc("block_state", { p_user: profile.id }),
    fetchAlbum(profile.id),
    fetchAchievementCounts(profile.id),
  ]);

  const relationship: Relationship =
    isOwner ? "none" : ((blockData.data as Relationship | null) ?? "none");

  const locked = profile.is_private && !isOwner && !followState.following;

  if (!isOwner && relationship === "none") {
    await supabase.rpc("record_profile_visit", { p_profile: profile.id });
  }

  const [visits, pinnedPost] = await Promise.all([
    profile.show_visits || isOwner ? fetchProfileVisits(profile.id) : Promise.resolve(null),
    profile.pinned_post_id && !locked ? fetchPostById(profile.pinned_post_id) : Promise.resolve(null),
  ]);

  const orderedPosts =
    pinnedPost && pinnedPost.author_id === profile.id
      ? [pinnedPost, ...posts.filter((post) => post.id !== pinnedPost.id)]
      : posts;

  return (
    <AppShell>
      <ProfileAccent color={profile.accent_color} />
      <div style={profileAccentStyle(profile.accent_color)}>
        <ProfileHeader
          profile={profile}
          stats={stats}
          viewerId={viewer.id}
          followState={followState}
          isOwner={isOwner}
          relationship={relationship}
          visits={visits?.total ?? 0}
          achievements={achievements}
        />

        {relationship === "blocking" ? (
          <div className="border-b border-line bg-surface px-6 py-14 text-center">
            <Ban size={26} className="mx-auto text-danger" />
            <h2 className="mt-3 text-lg font-semibold">Você bloqueou esta conta</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Nada de @{profile.username} aparece para você: publicações, seguidores e mensagens.
              Use o menu ⋯ no topo do perfil para desbloquear.
            </p>
          </div>
        ) : relationship === "blocked" ? (
          <div className="border-b border-line bg-surface px-6 py-14 text-center">
            <UserX size={26} className="mx-auto text-muted" />
            <h2 className="mt-3 text-lg font-semibold">Perfil indisponível</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Este perfil não pode ser exibido agora.
            </p>
          </div>
        ) : locked ? (
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
          <>
          {(isOwner || album.length > 0) && (
            <ProfileAlbum
              userId={profile.id}
              photos={album}
              isOwner={isOwner}
              username={profile.username}
            />
          )}
          <FeedList
            initialPosts={orderedPosts}
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
          </>
        )}
      </div>
    </AppShell>
  );
}
