import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Flame,
  Hash,
  Sparkles,
  Trophy,
  TrendingUp,
  Users2,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Ducky } from "@/components/ducky";
import { FollowButton } from "@/components/follow-button";
import { createClient } from "@/lib/supabase/server";
import { fetchTrendingTags } from "@/lib/hashtags";
import { fetchTrendingTopics } from "@/lib/topics";
import { fetchFriendsActivity } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export async function RightRail({ viewerId }: { viewerId: string }) {
  const supabase = await createClient();

  const [{ data: followRows }, { data: communityRows }, trending, topics, activity] =
    await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", viewerId),
      supabase
        .from("communities")
        .select("id, slug, name, description, members:community_members(count)")
        .order("created_at", { ascending: false })
        .limit(4),
      fetchTrendingTags(6),
      fetchTrendingTopics(6),
      fetchFriendsActivity(viewerId),
    ]);

  const followed = new Set((followRows ?? []).map((row: any) => row.following_id as string));

  let suggestions: Profile[] = [];
  if (followed.size < 30) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", viewerId)
      .eq("is_private", false)
      .is("deactivated_at", null)
      .order("created_at", { ascending: false })
      .limit(24);
    suggestions = ((data ?? []) as Profile[]).filter((profile) => !followed.has(profile.id)).slice(0, 4);
  }

  return (
    <div className="space-y-4">
      <section className="chupa-card p-3.5">
        <Ducky compact />
      </section>

      {topics.length > 0 && (
        <section className="chupa-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Flame size={14} className="text-accent" /> Assuntos do momento
            </h2>
            <span className="text-[0.68rem] text-muted">3 dias</span>
          </div>
          <ol className="mt-3 space-y-1">
            {topics.map((topic, index) => (
              <li key={topic.topic}>
                <Link
                  href={`/search?q=${encodeURIComponent(topic.topic)}&tab=publicacoes`}
                  className="-mx-1.5 flex items-baseline gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-2"
                >
                  <span className="w-3 text-[0.7rem] tabular-nums text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {topic.label}
                  </span>
                  <span className="text-[0.68rem] tabular-nums text-muted">
                    {topic.count} {topic.count === 1 ? "post" : "posts"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="chupa-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp size={14} className="text-accent" /> Em alta
          </h2>
          <span className="text-[0.68rem] text-muted">7 dias</span>
        </div>

        {trending.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            Ainda sem assuntos em alta. Use #hashtags nas publicações para começar.
          </p>
        ) : (
          <ol className="mt-3 space-y-1">
            {trending.map((item, index) => (
              <li key={item.tag}>
                <Link
                  href={`/hashtag/${encodeURIComponent(item.tag)}`}
                  className="flex items-baseline gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-surface-2"
                >
                  <span className="w-3 text-[0.7rem] tabular-nums text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    <span className="text-accent">#</span>
                    {item.tag}
                  </span>
                  <span className="text-[0.68rem] tabular-nums text-muted">
                    {item.count} {item.count === 1 ? "post" : "posts"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <Link
          href="/search?tab=publicacoes"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <Hash size={11} /> Explorar assuntos
        </Link>
      </section>

      {activity.length > 0 && (
        <section className="chupa-card p-4">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Users2 size={14} className="text-accent" /> Atividade dos amigos
          </h2>
          <ul className="mt-3 space-y-2.5">
            {activity.map((post) => (
              <li key={post.id} className="flex items-start gap-2">
                <Avatar profile={post.author} size={28} />
                <div className="min-w-0">
                  <Link
                    href={`/u/${post.author.username}`}
                    className="text-xs font-medium hover:underline"
                  >
                    {post.author.display_name}
                  </Link>
                  <Link
                    href={`/post/${post.id}`}
                    className="block truncate text-xs text-muted hover:text-ink"
                  >
                    {post.content || "publicou uma mídia"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="chupa-card p-4">
        <h2 className="text-sm font-semibold">Descobrir</h2>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              href="/ranking"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 text-sm hover:bg-surface-2"
            >
              <Trophy size={14} className="text-accent" /> Ranking da semana
            </Link>
          </li>
          <li>
            <Link
              href="/retrospectiva"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 text-sm hover:bg-surface-2"
            >
              <Sparkles size={14} className="text-accent" /> Sua retrospectiva
            </Link>
          </li>
          <li>
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 text-sm hover:bg-surface-2"
            >
              <Users2 size={14} className="text-accent" /> Chat das últimas 24 h
            </Link>
          </li>
          <li>
            <Link
              href="/patches"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 text-sm hover:bg-surface-2"
            >
              <Sparkles size={14} className="text-accent" /> Patches e avisos
            </Link>
          </li>
        </ul>
      </section>

      <section className="chupa-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Quem seguir</h2>
          <Link href="/search" className="text-xs text-accent hover:underline">
            buscar
          </Link>
        </div>

        {suggestions.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            Você já segue todo mundo por aqui. Explore a busca para encontrar mais gente.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {suggestions.map((profile) => (
              <li key={profile.id} className="flex items-center gap-2.5">
                <Avatar profile={profile} size={34} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${profile.username}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {profile.display_name}
                  </Link>
                  <p className="truncate text-xs text-muted">@{profile.username}</p>
                </div>
                <FollowButton
                  targetId={profile.id}
                  initialFollowing={false}
                  initialRequested={false}
                  isPrivate={false}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="chupa-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Comunidades</h2>
          <Link href="/communities" className="text-xs text-accent hover:underline">
            ver todas
          </Link>
        </div>

        {(communityRows ?? []).length === 0 ? (
          <div className="mt-3">
            <p className="text-xs text-muted">
              Nenhuma comunidade ainda. Que tal abrir a primeira sobre o assunto que você domina?
            </p>
            <Link href="/communities/new" className="mt-2 inline-flex text-xs font-medium text-accent hover:underline">
              Criar comunidade
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {(communityRows ?? []).map((community: any) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}`}
                  className="flex items-start gap-2.5 rounded-lg p-1.5 -m-1.5 hover:bg-surface-2"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft text-accent">
                    {community.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={community.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Compass size={15} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{community.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {Number(community.members?.[0]?.count ?? 0)} membros
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="chupa-card p-4">
        <h2 className="text-sm font-semibold">Sobre o ChupaSocial</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Comunidades, mensagens e chamadas. O feed "Para você" ordena por recência, engajamento e
          quem você segue — e você pode trocar para "Seguindo" a qualquer momento.
        </p>
        <Link
          href="/search"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Explorar agora <ArrowRight size={12} />
        </Link>
      </section>
    </div>
  );
}
