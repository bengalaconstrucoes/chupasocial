import Link from "next/link";
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
  fetchTopFriends,
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
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const requestedTab = (await searchParams).tab;
  const tab: "posts" | "reposts" | "replies" =
    requestedTab === "reposts" || requestedTab === "respostas"
      ? requestedTab === "reposts"
        ? "reposts"
        : "replies"
      : "posts";

  const { profile, viewer, supabase } = await load(username);

  if (!viewer) redirect(`/login?next=/u/${username}`);
  if (!profile) notFound();

  const isOwner = viewer.id === profile.id;
  const [stats, followState, posts, blockData, album, achievements] = await Promise.all([
    fetchProfileStats(profile.id),
    fetchFollowState(viewer.id, profile.id),
    fetchFeed({
      mode: "profile",
      profileId: profile.id,
      viewerId: viewer.id,
      limit: 12,
      filter: tab,
    }),
    isOwner ? Promise.resolve({ data: "none" }) : supabase.rpc("block_state", { p_user: profile.id }),
    tab === "posts" ? fetchAlbum(profile.id) : Promise.resolve([]),
    fetchAchievementCounts(profile.id),
  ]);

  const relationship: Relationship =
    isOwner ? "none" : ((blockData.data as Relationship | null) ?? "none");

  const locked = profile.is_private && !isOwner && !followState.following;

  if (!isOwner && relationship === "none") {
    await supabase.rpc("record_profile_visit", { p_profile: profile.id });
  }

  const [visits, pinnedPost, topFriends] = await Promise.all([
    profile.show_visits || isOwner ? fetchProfileVisits(profile.id) : Promise.resolve(null),
    profile.pinned_post_id && !locked && tab === "posts"
      ? fetchPostById(profile.pinned_post_id)
      : Promise.resolve(null),
    profile.profile_style === "y2k" ? fetchTopFriends(profile.id) : Promise.resolve([]),
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
          topFriends={topFriends}
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
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 sm:px-5">
            {[
              { key: "posts" as const, label: "Publicações", href: `/u/${profile.username}` },
              { key: "reposts" as const, label: "Reposts", href: `/u/${profile.username}?tab=reposts` },
              { key: "replies" as const, label: "Respostas", href: `/u/${profile.username}?tab=respostas` },
            ].map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={tab === item.key ? "page" : undefined}
                className={
                  tab === item.key
                    ? "shrink-0 rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-accent"
                    : "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>

          {(isOwner || album.length > 0) && tab === "posts" && (
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
            filter={tab}
            emptyTitle={
              tab === "reposts"
                ? "Nenhum repost por aqui"
                : tab === "replies"
                  ? "Nenhuma resposta por aqui"
                  : isOwner
                    ? "Você ainda não publicou nada"
                    : "Nenhuma publicação por aqui"
            }
            emptyDescription={
              tab === "reposts"
                ? isOwner
                  ? "Quando você repostar algo, aparece aqui."
                  : `Quando @${profile.username} repostar algo, aparece aqui.`
                : tab === "replies"
                  ? isOwner
                    ? "Suas respostas aparecem aqui separadas das publicações."
                    : `As respostas de @${profile.username} aparecem aqui.`
                  : isOwner
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
