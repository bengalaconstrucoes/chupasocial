import { createClient } from "@/lib/supabase/server";
import type {
  CommentItem,
  Community,
  ConversationSummary,
  FeedPost,
  NotificationItem,
  Profile,
} from "@/lib/types";

export const POST_SELECT = `
  id, author_id, community_id, repost_of, root_post_id, parent_post_id, content, created_at, edited_at,
  author:profiles!posts_author_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, location, accent_color, name_font, is_verified, is_admin, avatar_frame, song_url, flag, status_text, status_emoji, favorite_song, favorite_song_artist, pinned_post_id, show_stats, show_visits, profile_style, last_seen_at, is_private, deactivated_at, created_at, updated_at),
  media:post_media(id, storage_path, public_url, position, media_type),
  post_views(count),
  likes(count),
  replies:posts!root_post_id(count),
  reposts:posts!repost_of(count),
  community:communities(id, slug, name),
  collaborators:post_collaborators(user:profiles!post_collaborators_user_id_fkey(id, username, display_name, avatar_url, is_verified)),
  poll:polls(post_id, options:poll_options(id, label, position))
`;

type RawPost = Record<string, any>;

export function normalizePost(
  raw: RawPost,
  likedIds: Set<string>,
  repostedIds: Set<string>,
  savedIds: Set<string> = new Set(),
  viewerId?: string | null,
): FeedPost {
  const count = (value: unknown) => {
    if (Array.isArray(value)) return Number(value[0]?.count ?? 0);
    return Number(value ?? 0);
  };

  const rawPoll = Array.isArray(raw.poll) ? raw.poll[0] : raw.poll;
  let poll: FeedPost["poll"] = null;
  if (rawPoll) {
    const options = [...((rawPoll.options ?? []) as any[])]
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((option) => ({
        id: option.id as string,
        label: option.label as string,
        count: 0,
      }));
    poll = { options, my_vote: null, total: 0 };
  }

  const base: FeedPost = {
    id: raw.id,
    author_id: raw.author_id,
    community_id: raw.community_id ?? null,
    repost_of: raw.repost_of ?? null,
    root_post_id: raw.root_post_id ?? null,
    parent_post_id: raw.parent_post_id ?? null,
    content: raw.content ?? "",
    created_at: raw.created_at,
    edited_at: raw.edited_at ?? null,
    author: raw.author as Profile,
    media: [...((raw.media ?? []) as any[])].sort((a, b) => a.position - b.position),
    like_count: count(raw.likes),
    comment_count: count(raw.replies ?? raw.comments),
    repost_count: count(raw.reposts),
    view_count: count(raw.post_views),
    liked_by_me: likedIds.has(raw.id),
    reposted_by_me: repostedIds.has(raw.id),
    saved_by_me: savedIds.has(raw.id),
    community: raw.community ?? null,
    collaborators: ((raw.collaborators ?? []) as any[])
      .map((row) => row.user)
      .filter(Boolean),
    poll,
  };

  return base;
}

/**
 * O embed aninhado do post repostado (`posts!repost_of`) volta com `author` nulo
 * em algumas combinações de RLS/PostgREST, o que quebrava o feed inteiro.
 * Buscamos os posts originais numa segunda consulta e ligamos manualmente.
 */
async function attachRepostedPosts(
  rows: RawPost[],
  liked: Set<string>,
  reposted: Set<string>,
  saved: Set<string> = new Set(),
  viewerId?: string | null,
): Promise<FeedPost[]> {
  const posts = rows.map((row) => normalizePost(row, liked, reposted, saved, viewerId));
  const repostIds = [...new Set(rows.map((row) => row.repost_of).filter(Boolean))] as string[];
  if (repostIds.length === 0) return posts;

  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).in("id", repostIds);
  const originals = new Map<string, FeedPost>(
    ((data ?? []) as RawPost[]).map((row) => [
      row.id,
      normalizePost(row, liked, reposted, saved, viewerId),
    ]),
  );

  return posts.map((post) => {
    if (!post.repost_of) return post;
    return { ...post, reposted_post: originals.get(post.repost_of) ?? null };
  });
}

/**
 * Respostas mostram o post respondido em cima (estilo Twitter).
 * Buscamos os pais numa segunda consulta pelo mesmo motivo dos reposts.
 */
async function attachParentPosts(
  posts: FeedPost[],
  liked: Set<string>,
  reposted: Set<string>,
  saved: Set<string> = new Set(),
): Promise<FeedPost[]> {
  const parentIds = [
    ...new Set(
      posts.map((post) => post.parent_post_id ?? post.root_post_id).filter(Boolean) as string[],
    ),
  ];
  if (parentIds.length === 0) return posts;

  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).in("id", parentIds);
  const parents = new Map<string, FeedPost>(
    ((data ?? []) as RawPost[]).map((row) => [
      row.id,
      normalizePost(row, liked, reposted, saved),
    ]),
  );

  return posts.map((post) => {
    const key = post.parent_post_id ?? post.root_post_id;
    if (!key) return post;
    return { ...post, parent_post: parents.get(key) ?? null };
  });
}

export async function getMyLikes(postIds: string[]) {
  const empty = {
    liked: new Set<string>(),
    reposted: new Set<string>(),
    saved: new Set<string>(),
    userId: null as string | null,
  };
  if (postIds.length === 0) return empty;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [{ data: likes }, { data: reposts }, { data: saved }] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("posts").select("repost_of").eq("author_id", user.id).in("repost_of", postIds),
    supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
  ]);

  return {
    liked: new Set((likes ?? []).map((row: any) => row.post_id as string)),
    reposted: new Set((reposts ?? []).map((row: any) => row.repost_of as string)),
    saved: new Set((saved ?? []).map((row: any) => row.post_id as string)),
    userId: user.id,
  };
}

export async function fetchBlockedIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("blocked_user_ids");
  if (!data) return [];
  return Array.isArray(data) ? (data as string[]) : [];
}

export async function fetchFeed(options: {
  mode: "all" | "following" | "profile" | "community" | "hashtag";
  profileId?: string;
  communityId?: string;
  tag?: string;
  viewerId?: string;
  limit?: number;
  before?: string;
  personalize?: boolean;
  filter?: "all" | "posts" | "reposts" | "replies";
}): Promise<FeedPost[]> {
  const filter = options.filter ?? "all";
  const supabase = await createClient();
  const limit = options.limit ?? 12;
  // Buscamos bem mais candidatos no "Para você": assim dá para descartar o que a
  // pessoa já viu e ainda encher a primeira página.
  const fetchLimit = options.personalize && options.viewerId ? Math.min(96, limit * 6) : limit;
  const blocked = await fetchBlockedIds();

  let authorIds: string[] | null = null;
  if (options.mode === "following" && options.viewerId) {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", options.viewerId);
    authorIds = (data ?? []).map((row: any) => row.following_id as string);
    authorIds.push(options.viewerId);
  }

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  // Abas do perfil: publicações, reposts e respostas.
  if (filter === "replies") {
    query = query.not("root_post_id", "is", null);
  } else {
    query = query.is("root_post_id", null);
    if (filter === "posts") query = query.is("repost_of", null);
    if (filter === "reposts") query = query.not("repost_of", "is", null);
  }

  if (blocked.length > 0) query = query.not("author_id", "in", `(${blocked.join(",")})`);
  if (options.mode === "profile" && options.profileId) query = query.eq("author_id", options.profileId);
  if (options.mode === "following" && authorIds) {
    if (authorIds.length === 0) return [];
    query = query.in("author_id", authorIds);
  }
  if (options.mode === "community" && options.communityId) {
    // Comunidade privada: só quem foi aceito vê as publicações.
    const { data: community } = await supabase
      .from("communities")
      .select("is_private")
      .eq("id", options.communityId)
      .maybeSingle();
    if (community?.is_private) {
      const { data: membership } = await supabase
        .from("community_members")
        .select("status")
        .eq("community_id", options.communityId)
        .eq("user_id", options.viewerId ?? "")
        .maybeSingle();
      if (!membership || membership.status !== "active") return [];
    }
    query = query.eq("community_id", options.communityId);
  }
  if (options.mode === "hashtag" && options.tag) {
    query = query.ilike("content", `%#${options.tag}%`);
  }
  if (options.before) query = query.lt("created_at", options.before);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as RawPost[];
  const ids = rows.flatMap((row) => [row.id, row.repost_of].filter(Boolean));
  const { liked, reposted, saved, userId } = await getMyLikes(ids);

  const normalized = await attachParentPosts(
    await attachPollVotes(
      await attachRepostedPosts(rows, liked, reposted, saved, userId),
      userId,
    ),
    liked,
    reposted,
    saved,
  );

  if (!options.personalize || !options.viewerId) return normalized;
  return personalizePosts(normalized, options.viewerId, limit);
}

/**
 * Ordena o feed "Para você". O conteúdo continua sendo o mesmo; só a ordem
 * muda, com decaimento de tempo, engajamento relativo, afinidade (quem você
 * segue, amizade mútua), comunidades em comum e diversidade de autores.
 */
async function personalizePosts(
  posts: FeedPost[],
  viewerId: string,
  limit: number,
): Promise<FeedPost[]> {
  if (posts.length <= 1) return posts;

  const supabase = await createClient();
  const candidateIds = [
    ...new Set(
      posts
        .flatMap((post) => [post.id, post.repost_of, post.reposted_post?.id])
        .filter(Boolean) as string[],
    ),
  ];

  const [{ data: followingRows }, { data: followerRows }, { data: membershipRows }, { data: viewRows }] =
    await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", viewerId),
      supabase.from("follows").select("follower_id").eq("following_id", viewerId),
      supabase.from("community_members").select("community_id").eq("user_id", viewerId),
      candidateIds.length > 0
        ? supabase
            .from("post_views")
            .select("post_id")
            .eq("viewer_id", viewerId)
            .in("post_id", candidateIds)
        : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    ]);

  // Já viu: o post em si ou o original que ele reposta.
  const seen = new Set((viewRows ?? []).map((row: any) => row.post_id as string));
  const alreadySeen = (post: FeedPost) =>
    seen.has(post.id) ||
    Boolean(post.repost_of && seen.has(post.repost_of)) ||
    Boolean(post.reposted_post?.id && seen.has(post.reposted_post.id));

  // Sem conteúdo repetido na mesma página (repost + original, por exemplo).
  const contentSeen = new Set<string>();
  const uniquePosts = posts.filter((post) => {
    const key = post.repost_of ?? post.reposted_post?.id ?? post.id;
    if (contentSeen.has(key)) return false;
    contentSeen.add(key);
    return true;
  });

  const following = new Set((followingRows ?? []).map((row: any) => row.following_id as string));
  const mutual = new Set(
    (followerRows ?? [])
      .map((row: any) => row.follower_id as string)
      .filter((id) => following.has(id)),
  );
  const communities = new Set(
    (membershipRows ?? []).map((row: any) => row.community_id as string),
  );
  const now = Date.now();

  const scored = uniquePosts.map((post) => {
    const hours = Math.max(0, (now - new Date(post.created_at).getTime()) / 3_600_000);
    const engagement = post.like_count + post.comment_count * 1.6 + post.repost_count * 2.2;

    // Recência com meia-vida de ~30 h: o novo aparece, mas não domina para sempre.
    const freshness = Math.exp(-hours / 30) * 3;
    const engagementScore = Math.log1p(engagement) * 1.6;
    const views = Math.log1p(post.view_count ?? 0) * 0.25;

    let affinity = 0;
    if (post.author_id === viewerId) affinity = -1.6;
    else if (mutual.has(post.author_id)) affinity = 3.4;
    else if (following.has(post.author_id)) affinity = 2.2;

    const communityBoost = post.community_id && communities.has(post.community_id) ? 0.9 : 0;

    // Um sopro de aleatoriedade para o feed não ficar idêntico a cada recarga.
    const shake = Math.random() * 0.7;

    return {
      post,
      seen: alreadySeen(post),
      score: freshness + engagementScore + views + affinity + communityBoost + shake,
    };
  });

  // O que já passou pela tela vai para o fim da fila; só volta se faltar conteúdo.
  scored.sort((a, b) => {
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    return b.score - a.score;
  });

  // Diversidade: no máximo 2 posts do mesmo autor na primeira passada.
  const chosen: FeedPost[] = [];
  const capped: FeedPost[] = [];
  const perAuthor = new Map<string, number>();

  for (const entry of scored) {
    const used = perAuthor.get(entry.post.author_id) ?? 0;
    if (used >= 2) {
      capped.push(entry.post);
      continue;
    }
    perAuthor.set(entry.post.author_id, used + 1);
    chosen.push(entry.post);
    if (chosen.length >= limit) break;
  }

  if (chosen.length < limit) {
    const seen = new Set(chosen.map((post) => post.id));
    for (const post of capped) {
      if (seen.has(post.id)) continue;
      chosen.push(post);
      if (chosen.length >= limit) break;
    }
  }

  return chosen.slice(0, limit);
}

export async function fetchPostById(postId: string): Promise<FeedPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .is("hidden_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as RawPost;
  const ids = [row.id, row.repost_of].filter(Boolean);
  const { liked, reposted, saved, userId } = await getMyLikes(ids);
  const [post] = await attachPollVotes(
    await attachRepostedPosts([row], liked, reposted, saved, userId),
    userId,
  );
  return post ?? null;
}

export async function fetchComments(postId: string): Promise<CommentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("root_post_id", postId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) return [];

  const rows = data as unknown as RawPost[];
  const { liked, reposted, saved, userId } = await getMyLikes(
    rows.flatMap((row) => [row.id, row.repost_of].filter(Boolean)),
  );
  const posts = await attachRepostedPosts(rows, liked, reposted, saved, userId);

  const index = new Map<string, CommentItem>();
  const roots: CommentItem[] = [];
  for (const post of posts) index.set(post.id, { ...post, replies: [] });
  for (const post of posts) {
    const node = index.get(post.id)!;
    const parent = post.parent_post_id ? index.get(post.parent_post_id) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  const withPolls = await attachPollVotes(roots.flatMap((root) => [root, ...root.replies]), userId);
  const byId = new Map(withPolls.map((post) => [post.id, post]));
  return roots.map((root) => {
    const updated = byId.get(root.id) ?? root;
    return {
      ...updated,
      replies: (updated.replies ?? root.replies).map((reply) => byId.get(reply.id) ?? reply),
    };
  });
}

/**
 * Contagem de votos das enquetes vem numa consulta separada: assim um embed
 * aninhado mais exótico nunca derruba o feed inteiro.
 */
export async function attachPollVotes<T extends FeedPost>(
  posts: T[],
  viewerId?: string | null,
): Promise<T[]> {
  const withPoll = posts.filter((post) => post.poll);
  if (withPoll.length === 0) return posts;

  const supabase = await createClient();
  const ids = withPoll.map((post) => post.id);
  const { data: votes } = await supabase
    .from("poll_votes")
    .select("post_id, option_id, user_id")
    .in("post_id", ids);

  const grouped = new Map<string, Array<{ optionId: string; userId: string }>>();
  for (const vote of votes ?? []) {
    const list = grouped.get(vote.post_id) ?? [];
    list.push({ optionId: vote.option_id, userId: vote.user_id });
    grouped.set(vote.post_id, list);
  }

  return posts.map((post) => {
    if (!post.poll) return post;
    const list = grouped.get(post.id) ?? [];
    const options = post.poll.options.map((option) => ({
      ...option,
      count: list.filter((vote) => vote.optionId === option.id).length,
    }));
    return {
      ...post,
      poll: {
        options,
        my_vote: viewerId
          ? list.find((vote) => vote.userId === viewerId)?.optionId ?? null
          : null,
        total: list.length,
      },
    } as T;
  });
}

export type StoryItem = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  author: Profile;
  stories: StoryItem[];
};

/** Stories ativos de quem o usuário segue (e os próprios). */
export async function fetchStories(viewerId: string): Promise<StoryGroup[]> {
  const supabase = await createClient();

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId);

  const ids = [viewerId, ...(following ?? []).map((row: any) => row.following_id as string)];

  const { data } = await supabase
    .from("stories")
    .select("*, author:profiles!stories_author_id_fkey(*)")
    .in("author_id", ids)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(120);

  if (!data) return [];

  const groups = new Map<string, StoryGroup>();
  for (const row of data as any[]) {
    const author = row.author as Profile | null;
    if (!author) continue;
    const group = groups.get(author.id) ?? { author, stories: [] };
    group.stories.push({
      id: row.id,
      author_id: row.author_id,
      media_url: row.media_url,
      media_type: row.media_type,
      caption: row.caption,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
    groups.set(author.id, group);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.author.id === viewerId) return -1;
    if (b.author.id === viewerId) return 1;
    return 0;
  });
}

export async function fetchSavedPosts(userId: string): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data: saves } = await supabase
    .from("saved_posts")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!saves || saves.length === 0) return [];

  const ids = saves.map((row: any) => row.post_id as string);
  const { data } = await supabase.from("posts").select(POST_SELECT).in("id", ids);
  if (!data) return [];

  const rows = data as unknown as RawPost[];
  const position = new Map(ids.map((id, index) => [id, index]));
  rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

  const { liked, reposted, saved } = await getMyLikes(
    rows.flatMap((row) => [row.id, row.repost_of].filter(Boolean)),
  );
  return attachPollVotes(
    await attachRepostedPosts(rows, liked, reposted, saved, userId),
    userId,
  );
}

export async function fetchProfileVisits(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_visit_stats", { p_user: profileId });
  const row = Array.isArray(data) ? data[0] : null;
  return {
    total: Number(row?.total_visits ?? 0),
    unique: Number(row?.unique_visitors ?? 0),
    recent: Number(row?.recent_visitors ?? 0),
  };
}

export async function fetchProfileByUsername(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function fetchProfileById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function fetchProfileStats(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_stats", { p_user: userId });
  const row = Array.isArray(data) ? data[0] : null;
  return {
    followers: Number(row?.followers ?? 0),
    following: Number(row?.following ?? 0),
    posts: Number(row?.posts ?? 0),
  };
}

export type TopFriend = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "avatar_frame" | "is_verified"
>;

/** Top 8 do perfil estilo MySpace: quem a pessoa segue mais recentemente. */
export async function fetchTopFriends(userId: string, limit = 8): Promise<TopFriend[]> {
  const supabase = await createClient();
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const ids = (follows ?? []).map((row: any) => row.following_id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, avatar_frame, is_verified")
    .in("id", ids);

  const people = (data ?? []) as TopFriend[];
  const position = new Map(ids.map((id, index) => [id, index]));
  return people.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

export async function fetchFollowState(viewerId: string | undefined, targetId: string) {
  if (!viewerId || viewerId === targetId) return { following: false, requested: false };
  const supabase = await createClient();
  const [{ data: follow }, { data: request }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("following_id", targetId)
      .maybeSingle(),
    supabase
      .from("follow_requests")
      .select("requester_id")
      .eq("requester_id", viewerId)
      .eq("target_id", targetId)
      .maybeSingle(),
  ]);
  return { following: Boolean(follow), requested: Boolean(request) };
}

export async function fetchFollowList(userId: string, kind: "followers" | "following") {
  const supabase = await createClient();
  const column = kind === "followers" ? "following_id" : "follower_id";
  const select = kind === "followers" ? "follower:profiles!follows_follower_id_fkey(*)" : "following:profiles!follows_following_id_fkey(*)";

  const { data } = await supabase.from("follows").select(select).eq(column, userId).limit(100);
  if (!data) return [] as Profile[];
  return (data as any[]).map((row) => row.follower ?? row.following).filter(Boolean) as Profile[];
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const blocked = await fetchBlockedIds();
  let query = supabase
    .from("notifications")
    .select(
      `id, type, read_at, created_at, post_id, comment_id, conversation_id, community_id,
       actor:profiles!notifications_actor_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, location, accent_color, name_font, is_private, deactivated_at, created_at, updated_at),
       community:communities(slug, name)`,
    )
    .eq("user_id", userId);

  if (blocked.length > 0) query = query.not("actor_id", "in", `(${blocked.join(",")})`);

  const { data } = await query.order("created_at", { ascending: false }).limit(40);
  return (data ?? []) as unknown as NotificationItem[];
}

export async function fetchUnreadNotificationCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function fetchUnreadMessageCount(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  if (!data || data.length === 0) return 0;

  const results = await Promise.all(
    data.map(async (member: any) => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", member.conversation_id)
        .gt("created_at", member.last_read_at)
        .neq("sender_id", userId);
      return count ?? 0;
    }),
  );
  return results.reduce((sum, value) => sum + value, 0);
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at, conversation:conversations(id, last_message_at, title)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const summaries = await Promise.all(
    memberships.map(async (membership: any) => {
      const conversationId = membership.conversation_id as string;
      const [{ data: memberRows }, { data: lastMessages }, { count: unread }] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("user:profiles!conversation_members_user_id_fkey(*)")
          .eq("conversation_id", conversationId),
        supabase
          .from("messages")
          .select("body, attachment_type")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .gt("created_at", membership.last_read_at)
          .neq("sender_id", userId),
      ]);

      const members = ((memberRows ?? [])
        .map((row: any) => row.user as Profile | null)
        .filter(Boolean) as Profile[]);
      const other = members.find((member) => member.id !== userId) ?? null;
      const title = (membership.conversation?.title as string | null) ?? null;
      const last = lastMessages?.[0];

      return {
        id: conversationId,
        last_message_at: membership.conversation?.last_message_at ?? new Date().toISOString(),
        title,
        is_group: Boolean(title) || members.length > 2,
        members,
        other,
        last_message: last
          ? last.body || (last.attachment_type === "gif" ? "GIF" : "Imagem")
          : null,
        unread_count: unread ?? 0,
      } satisfies ConversationSummary;
    }),
  );

  return summaries.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );
}

export async function fetchCommunities(viewerId?: string): Promise<Community[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("*, members:community_members(count)")
    .order("created_at", { ascending: false })
    .limit(60);

  const communities = (data ?? []).map((row: any) => ({
    ...row,
    member_count: Number(row.members?.[0]?.count ?? 0),
  })) as Community[];

  if (!viewerId || communities.length === 0) return communities;

  const { data: mine } = await supabase
    .from("community_members")
    .select("community_id, role")
    .eq("user_id", viewerId)
    .in("community_id", communities.map((community) => community.id));

  const roles = new Map<string, any>((mine ?? []).map((row: any) => [row.community_id, row.role]));
  return communities.map((community) => ({
    ...community,
    is_member: roles.has(community.id),
    my_role: roles.get(community.id) ?? null,
  }));
}

export async function fetchCommunityBySlug(slug: string, viewerId?: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("*, members:community_members(count)")
    .ilike("slug", slug)
    .maybeSingle();
  if (!data) return null;

  const community = { ...(data as any), member_count: Number((data as any).members?.[0]?.count ?? 0) } as Community;

  if (viewerId) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("role, status")
      .eq("community_id", community.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    community.is_member = Boolean(membership) && (membership as any)?.status !== "pending";
    community.my_role = (membership as any)?.role ?? null;
    community.my_status = (membership as any)?.status ?? null;
  }
  return community;
}

export type AlbumPhoto = {
  id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

/** Álbum de fotos do perfil (mais recentes primeiro). */
export async function fetchAlbum(profileId: string): Promise<AlbumPhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_photos")
    .select("id, user_id, photo_url, caption, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(24);

  return (data ?? []) as AlbumPhoto[];
}

export type WeeklyRankingRow = {
  rank: number;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "is_verified">;
  points: number;
  posts: number;
  likes: number;
};

/** Ranking dos últimos 7 dias: posts, curtidas recebidas e novos seguidores. */
export async function fetchWeeklyRanking(limit = 10): Promise<WeeklyRankingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("weekly_ranking", { p_limit: limit });
  if (!Array.isArray(data)) return [];

  return data.map((row: any, index: number) => ({
    rank: index + 1,
    profile: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
    },
    points: Number(row.points ?? 0),
    posts: Number(row.posts ?? 0),
    likes: Number(row.likes_received ?? 0),
  }));
}

export type AchievementCounts = {
  posts: number;
  likes: number;
  followers: number;
  communities: number;
  days: number;
};

export async function fetchAchievementCounts(profileId: string): Promise<AchievementCounts> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_achievement_counts", { p_user: profileId });
  const row = Array.isArray(data) ? data[0] : null;
  return {
    posts: Number(row?.posts ?? 0),
    likes: Number(row?.likes_received ?? 0),
    followers: Number(row?.followers ?? 0),
    communities: Number(row?.communities ?? 0),
    days: Number(row?.days ?? 0),
  };
}

/** Publicações antigas do próprio usuário no mesmo dia e mês ("nesse dia"). */
export async function fetchMemories(viewerId: string): Promise<FeedPost[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", viewerId)
    .is("root_post_id", null)
    .is("repost_of", null)
    .is("hidden_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(150);

  if (!data) return [];

  const now = new Date();
  const rows = (data as unknown as RawPost[]).filter((row) => {
    const date = new Date(row.created_at);
    return date.getUTCDate() === now.getUTCDate() && date.getUTCMonth() === now.getUTCMonth();
  }).slice(0, 3);

  if (rows.length === 0) return [];

  const ids = rows.flatMap((row) => [row.id, row.repost_of].filter(Boolean));
  const { liked, reposted, saved, userId } = await getMyLikes(ids);
  return attachPollVotes(await attachRepostedPosts(rows, liked, reposted, saved, userId), userId);
}

/** Atividade recente de quem o usuário segue. */
export async function fetchFriendsActivity(viewerId: string): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .limit(200);

  const ids = (following ?? []).map((row: any) => row.following_id as string);
  if (ids.length === 0) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("author_id", ids)
    .is("root_post_id", null)
    .is("hidden_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data) return [];

  const rows = data as unknown as RawPost[];
  const postIds = rows.flatMap((row) => [row.id, row.repost_of].filter(Boolean));
  const { liked, reposted, saved, userId } = await getMyLikes(postIds);
  return attachPollVotes(await attachRepostedPosts(rows, liked, reposted, saved, userId), userId);
}

export type Retrospective = {
  year: number;
  posts: number;
  likes: number;
  followersGained: number;
  topHashtag: string | null;
  busiestMonth: string | null;
  bestPost: { id: string; content: string; likes: number } | null;
};

/** Retrospectiva do ano corrente. */
export async function fetchRetrospective(userId: string): Promise<Retrospective> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const start = `${year}-01-01T00:00:00.000Z`;

  const [{ data: posts }, { count: followersGained }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, content, created_at, likes(count)")
      .eq("author_id", userId)
      .is("root_post_id", null)
      .is("repost_of", null)
      .gte("created_at", start)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId)
      .gte("created_at", start),
  ]);

  const rows = (posts ?? []) as any[];
  const counts = rows.map((row) => ({
    id: row.id as string,
    content: (row.content as string) ?? "",
    created_at: row.created_at as string,
    likes: Array.isArray(row.likes) ? Number(row.likes[0]?.count ?? 0) : Number(row.likes ?? 0),
  }));

  const likes = counts.reduce((sum, row) => sum + row.likes, 0);
  const best = counts.reduce<Retrospective["bestPost"]>((top, row) => {
    if (row.likes === 0) return top;
    if (!top || row.likes > top.likes) {
      return { id: row.id, content: row.content, likes: row.likes };
    }
    return top;
  }, null);

  const tagCounts = new Map<string, number>();
  for (const row of counts) {
    for (const match of row.content.matchAll(/#([\p{L}0-9_]{2,40})/gu)) {
      const tag = match[1].toLowerCase();
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topHashtag =
    [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const monthCounts = new Map<number, number>();
  for (const row of counts) {
    const month = new Date(row.created_at).getMonth();
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const busiest = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const monthName =
    busiest === undefined
      ? null
      : new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, busiest, 1));

  return {
    year,
    posts: counts.length,
    likes,
    followersGained: followersGained ?? 0,
    topHashtag,
    busiestMonth: monthName,
    bestPost: best,
  };
}
