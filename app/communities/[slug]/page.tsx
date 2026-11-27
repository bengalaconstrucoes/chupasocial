import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Compass, Settings2, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { Composer } from "@/components/composer";
import { CommunityJoinButton } from "@/components/community-join-button";
import { LiveRoomCreate } from "@/components/live-room-create";
import { FeedList } from "@/components/feed-list";
import { fetchCommunityBySlug, fetchFeed } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCount, formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const community = await fetchCommunityBySlug(slug);
  if (!community) return { title: "Comunidade não encontrada" };
  return {
    title: community.name,
    description: community.description || `Comunidade ${community.name} no ChupaSocial.`,
  };
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/communities/${slug}`);

  const community = await fetchCommunityBySlug(slug, user.id);
  if (!community) notFound();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileData) redirect("/login?erro=sessao");

  const activeTab = tab === "membros" ? "membros" : tab === "salas" ? "salas" : "publicacoes";
  const canModerate = community.my_role === "owner" || community.my_role === "moderator";

  const [posts, { data: members }, { data: rooms }] = await Promise.all([
    activeTab === "publicacoes"
      ? fetchFeed({ mode: "community", communityId: community.id, viewerId: user.id, limit: 12 })
      : Promise.resolve([]),
    activeTab === "membros"
      ? supabase
          .from("community_members")
          .select("role, status, joined_at, user:profiles!community_members_user_id_fkey(*)")
          .eq("community_id", community.id)
          .eq("status", "active")
          .order("joined_at", { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [] } as any),
    activeTab === "salas"
      ? supabase
          .from("live_rooms")
          .select("id, title, status, created_at, host:profiles!live_rooms_host_id_fkey(username, display_name)")
          .eq("community_id", community.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] } as any),
  ]);

  return (
    <AppShell>
      <section className="border-b border-line bg-surface">
        <div className="relative h-28 overflow-hidden bg-surface-2">
          {community.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(circle at 20% 120%, var(--accent-soft) 0%, transparent 65%), radial-gradient(circle at 82% -20%, var(--accent-soft) 0%, transparent 55%)",
              }}
              aria-hidden
            />
          )}
        </div>

        <div className="px-4 pb-4 sm:px-5">
          <div className="-mt-8 flex items-end justify-between gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-surface bg-accent-soft text-accent">
              {community.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={community.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Compass size={24} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {canModerate && (
                <Link href={`/communities/${community.slug}/settings`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                  <Settings2 size={13} /> gerenciar
                </Link>
              )}
              <CommunityJoinButton
                communityId={community.id}
                isMember={Boolean(community.is_member)}
                isOwner={community.my_role === "owner"}
                requiresApproval={Boolean(community.requires_approval)}
                pendingRequest={community.my_status === "pending"}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{community.name}</h1>
            {community.my_role === "owner" && (
              <span className="chip !py-0.5">
                <ShieldCheck size={11} /> dono
              </span>
            )}
            {community.my_role === "moderator" && (
              <span className="chip !py-0.5">
                <ShieldCheck size={11} /> moderador
              </span>
            )}
          </div>

          {community.description && (
            <p className="prose-chupa mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {community.description}
            </p>
          )}

          {(community.emojis ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Emojis da comunidade">
              {(community.emojis ?? []).map((emoji) => (
                <li
                  key={emoji}
                  className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-sm"
                >
                  {emoji}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {formatCount(community.member_count ?? 0)} membros
            </span>
            <span>Criada em {formatDate(community.created_at)}</span>
            <Link href={`/u/${community.creator_id}`} className="hover:underline">
              ver criador
            </Link>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-1 border-b border-line bg-surface px-4 py-2 sm:px-5">
        {[
          { key: "publicacoes", label: "Publicações" },
          { key: "membros", label: "Membros" },
          { key: "salas", label: "Ao vivo" },
        ].map((item) => (
          <Link
            key={item.key}
            href={
              item.key === "publicacoes"
                ? `/communities/${community.slug}`
                : `/communities/${community.slug}?tab=${item.key}`
            }
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium",
              activeTab === item.key
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {activeTab === "publicacoes" ? (
        <>
          {community.is_member && (
            <Composer
              profile={profileData as Profile}
              defaultCommunityId={community.id}
              communities={[{ id: community.id, name: community.name, slug: community.slug }]}
              placeholder={`Publicar em ${community.name}…`}
              quickEmojis={community.emojis ?? []}
            />
          )}
          <FeedList
            initialPosts={posts}
            viewerId={user.id}
            mode="community"
            communityId={community.id}
            emptyTitle="Nada publicado por aqui ainda"
            emptyDescription={
              community.is_member
                ? "Seja a primeira pessoa a abrir a conversa nesta comunidade."
                : "Entre na comunidade para publicar e participar da conversa."
            }
          />
        </>
      ) : activeTab === "salas" ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {canModerate && <LiveRoomCreate communityId={community.id} />}

          {(rooms ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma sala por aqui. {canModerate ? "Abra a primeira." : "Volte quando alguém abrir uma."}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {(rooms ?? []).map((room: any) => (
                <li key={room.id}>
                  <Link
                    href={`/communities/${community.slug}/rooms/${room.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        room.status === "live" ? "bg-emerald-500" : "bg-muted",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{room.title}</span>
                      <span className="block truncate text-xs text-muted">
                        por {room.host?.display_name ?? "alguém"} ·{" "}
                        {room.status === "live" ? "ao vivo" : "encerrada"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {(members ?? []).map((member: any) => {
            const profile = member.user as Profile;
            return (
              <li key={profile.id} className="flex items-center gap-3 bg-surface px-4 py-3 sm:px-5">
                <Avatar profile={profile} size={38} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${profile.username}`} className="block truncate text-sm font-semibold hover:underline">
                    {profile.display_name}
                  </Link>
                  <p className="truncate text-xs text-muted">@{profile.username}</p>
                </div>
                {member.role !== "member" && (
                  <span className="chip !py-0.5">
                    <ShieldCheck size={11} /> {member.role === "owner" ? "dono" : "moderador"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
