import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Compass, Search as SearchIcon, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PostCard } from "@/components/post-card";
import {
  attachPollVotes,
  fetchBlockedIds,
  getMyLikes,
  normalizePost,
  POST_SELECT,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCount } from "@/lib/utils";
import type { Community, FeedPost, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Buscar" };

type Tab = "pessoas" | "publicacoes" | "comunidades";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    autor?: string;
    desde?: string;
    midia?: string;
    ordem?: string;
  }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tab: Tab =
    params.tab === "publicacoes" || params.tab === "comunidades" ? params.tab : "pessoas";
  const authorFilter = (params.autor ?? "").trim().replace(/^@/, "").toLowerCase();
  const sinceFilter = (params.desde ?? "").trim();
  const onlyMedia = params.midia === "1";
  const popular = params.ordem === "popular";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  let people: Array<Profile & { following?: boolean }> = [];
  let posts: FeedPost[] = [];
  let communities: Community[] = [];
  const blocked = await fetchBlockedIds();

  if (q.length >= 2) {
    const term = `%${q}%`;
    if (tab === "pessoas") {
      let peopleQuery = supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.${term},display_name.ilike.${term}`)
        .neq("id", user.id)
        .limit(25);
      if (blocked.length > 0) peopleQuery = peopleQuery.not("id", "in", `(${blocked.join(",")})`);
      const { data } = await peopleQuery;
      people = (data ?? []) as Profile[];

      if (people.length > 0) {
        const { data: followRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", people.map((person) => person.id));
        const followed = new Set((followRows ?? []).map((row: any) => row.following_id));
        people = people.map((person) => ({ ...person, following: followed.has(person.id) }));
      }
    }

    if (tab === "publicacoes") {
      let postsQuery = supabase
        .from("posts")
        .select(POST_SELECT)
        .ilike("content", term)
        .is("root_post_id", null)
        .order("created_at", { ascending: false })
        .limit(popular || onlyMedia ? 60 : 25);
      if (blocked.length > 0) postsQuery = postsQuery.not("author_id", "in", `(${blocked.join(",")})`);

      if (authorFilter) {
        const { data: author } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", authorFilter)
          .maybeSingle();
        postsQuery = author
          ? postsQuery.eq("author_id", author.id)
          : postsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      if (sinceFilter && /^\d{4}-\d{2}-\d{2}$/.test(sinceFilter)) {
        postsQuery = postsQuery.gte("created_at", `${sinceFilter}T00:00:00.000Z`);
      }

      if (onlyMedia) {
        const { data: mediaRows } = await supabase
          .from("post_media")
          .select("post_id")
          .limit(1000);
        const mediaIds = [...new Set((mediaRows ?? []).map((row: any) => row.post_id as string))];
        postsQuery = mediaIds.length
          ? postsQuery.in("id", mediaIds)
          : postsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data } = await postsQuery;

      if (data && data.length > 0) {
        const ids = data.map((row: any) => row.id);
        const { liked, reposted, saved, userId } = await getMyLikes(ids);
        posts = await attachPollVotes(
          data.map((row) => normalizePost(row, liked, reposted, saved, userId)),
          userId,
        );
        if (popular) {
          posts.sort((a, b) => b.like_count + b.repost_count - (a.like_count + a.repost_count));
        }
      }
    }

    if (tab === "comunidades") {
      const { data } = await supabase
        .from("communities")
        .select("*, members:community_members(count)")
        .or(`name.ilike.${term},description.ilike.${term}`)
        .limit(25);
      communities = ((data ?? []) as any[]).map((row) => ({
        ...row,
        member_count: Number(row.members?.[0]?.count ?? 0),
      }));
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "pessoas", label: "Pessoas" },
    { key: "publicacoes", label: "Publicações" },
    { key: "comunidades", label: "Comunidades" },
  ];

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="text-base font-semibold">Buscar</h1>
        <form action="/search" method="get" className="mt-2">
          <input type="hidden" name="tab" value={tab} />
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Pessoas, publicações ou comunidades"
              className="field pl-9"
              aria-label="Termo de busca"
              autoFocus={!q}
            />
          </div>

          {tab === "publicacoes" && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input
                name="autor"
                defaultValue={params.autor ?? ""}
                placeholder="de @usuário"
                className="field !py-1.5 text-xs"
                aria-label="Filtrar por usuário"
              />
              <input
                name="desde"
                type="date"
                defaultValue={params.desde ?? ""}
                className="field !py-1.5 text-xs"
                aria-label="A partir da data"
              />
              <label className="flex items-center gap-1.5 rounded-lg border border-line px-2 text-xs text-muted">
                <input
                  type="checkbox"
                  name="midia"
                  value="1"
                  defaultChecked={onlyMedia}
                  className="accent-[var(--accent)]"
                />
                com mídia
              </label>
              <select
                name="ordem"
                defaultValue={popular ? "popular" : "recente"}
                className="field !py-1.5 text-xs"
                aria-label="Ordenar por"
              >
                <option value="recente">mais recentes</option>
                <option value="popular">mais populares</option>
              </select>
            </div>
          )}
        </form>
      </div>

      <div className="flex items-center gap-1 border-b border-line bg-surface px-4 py-2 sm:px-5">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/search?q=${encodeURIComponent(q)}&tab=${item.key}${
              item.key === "publicacoes"
                ? `&autor=${encodeURIComponent(params.autor ?? "")}&desde=${encodeURIComponent(
                    params.desde ?? "",
                  )}&midia=${onlyMedia ? "1" : ""}&ordem=${popular ? "popular" : "recente"}`
                : ""
            }`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium",
              tab === item.key ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {q.length < 2 ? (
        <div className="px-6 py-16 text-center">
          <SearchIcon size={24} className="mx-auto text-muted" />
          <h2 className="mt-3 text-base font-semibold">O que você quer encontrar?</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Digite pelo menos 2 caracteres. A busca cobre perfis, publicações e comunidades.
          </p>
        </div>
      ) : (
        <div>
          {tab === "pessoas" &&
            (people.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-muted">
                Nenhuma pessoa encontrada para “{q}”.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 bg-surface px-4 py-3 sm:px-5">
                    <Avatar profile={person} size={42} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/u/${person.username}`} className="block truncate text-sm font-semibold hover:underline">
                        {person.display_name}
                      </Link>
                      <p className="truncate text-xs text-muted">@{person.username}</p>
                      {person.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{person.bio}</p>}
                    </div>
                    {person.following ? (
                      <span className="chip !py-1">seguindo</span>
                    ) : (
                      <FollowButton
                        targetId={person.id}
                        initialFollowing={false}
                        initialRequested={false}
                        isPrivate={person.is_private}
                        size="sm"
                      />
                    )}
                  </li>
                ))}
              </ul>
            ))}

          {tab === "publicacoes" &&
            (posts.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-muted">
                Nenhuma publicação encontrada para “{q}”.
              </p>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} viewerId={user.id} />)
            ))}

          {tab === "comunidades" &&
            (communities.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-muted">
                Nenhuma comunidade encontrada para “{q}”.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {communities.map((community) => (
                  <li key={community.id} className="flex items-start gap-3 bg-surface px-4 py-4 sm:px-5">
                    <Link
                      href={`/communities/${community.slug}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-accent-soft text-accent"
                    >
                      {community.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={community.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Compass size={18} />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/communities/${community.slug}`} className="text-sm font-semibold hover:underline">
                        {community.name}
                      </Link>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {community.description || "Sem descrição."}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted">
                        <Users size={11} /> {formatCount(community.member_count ?? 0)} membros
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </AppShell>
  );
}
