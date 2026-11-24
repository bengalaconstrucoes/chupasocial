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
  id, author_id, community_id, repost_of, content, created_at, edited_at,
  author:profiles!posts_author_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, is_private, deactivated_at, created_at, updated_at),
  media:post_media(id, storage_path, public_url, position),
  likes(count),
  comments(count),
  reposts:posts!repost_of(count),
  community:communities(id, slug, name),
  reposted_post:posts!repost_of(
    id, author_id, community_id, repost_of, content, created_at, edited_at,
    author:profiles!posts_author_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, is_private, deactivated_at, created_at, updated_at),
    media:post_media(id, storage_path, public_url, position),
    likes(count),
    comments(count),
    reposts:posts!repost_of(count),
    community:communities(id, slug, name)
  )
`;

type RawPost = Record<string, any>;

export function normalizePost(
  raw: RawPost,
  likedIds: Set<string>,
  repostedIds: Set<string>,
): FeedPost {
  const count = (value: unknown) => {
    if (Array.isArray(value)) return Number(value[0]?.count ?? 0);
    return Number(value ?? 0);
  };

  const base: FeedPost = {
    id: raw.id,
    author_id: raw.author_id,
    community_id: raw.community_id ?? null,
    repost_of: raw.repost_of ?? null,
    content: raw.content ?? "",
    created_at: raw.created_at,
    edited_at: raw.edited_at ?? null,
    author: raw.author as Profile,
    media: [...((raw.media ?? []) as any[])].sort((a, b) => a.position - b.position),
    like_count: count(raw.likes),
    comment_count: count(raw.comments),
    repost_count: count(raw.reposts),
    liked_by_me: likedIds.has(raw.id),
    reposted_by_me: repostedIds.has(raw.id),
    community: raw.community ?? null,
  };

  if (raw.reposted_post) {
    base.reposted_post = normalizePost(raw.reposted_post, likedIds, repostedIds);
  }

  return base;
}

export async function getMyLikes(postIds: string[]) {
  if (postIds.length === 0) return { liked: new Set<string>(), reposted: new Set<string>() };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { liked: new Set<string>(), reposted: new Set<string>() };

  const [{ data: likes }, { data: reposts }] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("posts").select("repost_of").eq("author_id", user.id).in("repost_of", postIds),
  ]);

  return {
    liked: new Set((likes ?? []).map((row: any) => row.post_id as string)),
    reposted: new Set((reposts ?? []).map((row: any) => row.repost_of as string)),
  };
}

export async function fetchFeed(options: {
  mode: "all" | "following" | "profile" | "community";
  profileId?: string;
  communityId?: string;
  viewerId?: string;
  limit?: number;
  before?: string;
}): Promise<FeedPost[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 12;

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
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.mode === "profile" && options.profileId) query = query.eq("author_id", options.profileId);
  if (options.mode === "following" && authorIds) {
    if (authorIds.length === 0) return [];
    query = query.in("author_id", authorIds);
  }
  if (options.mode === "community" && options.communityId) {
    query = query.eq("community_id", options.communityId);
  }
  if (options.before) query = query.lt("created_at", options.before);

  const { data, error } = await query;
  if (error || !data) return [];

  const ids = data.flatMap((row: any) => [row.id, row.reposted_post?.id].filter(Boolean));
  const { liked, reposted } = await getMyLikes(ids);

  return data.map((row) => normalizePost(row, liked, reposted));
}

export async function fetchPostById(postId: string): Promise<FeedPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("id", postId).maybeSingle();
  if (error || !data) return null;
  const ids = [data.id, (data as any).reposted_post?.id].filter(Boolean);
  const { liked, reposted } = await getMyLikes(ids);
  return normalizePost(data, liked, reposted);
}

export async function fetchComments(postId: string): Promise<CommentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, post_id, parent_id, content, created_at,
       author:profiles!comments_author_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, is_private, deactivated_at, created_at, updated_at)`,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const items = data as unknown as CommentItem[];
  const roots: CommentItem[] = [];
  const index = new Map<string, CommentItem>();

  for (const item of items) {
    index.set(item.id, { ...item, replies: [] });
  }
  for (const item of items) {
    const node = index.get(item.id)!;
    if (item.parent_id && index.has(item.parent_id)) {
      index.get(item.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
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
  const { data } = await supabase
    .from("notifications")
    .select(
      `id, type, read_at, created_at, post_id, comment_id, conversation_id, community_id,
       actor:profiles!notifications_actor_id_fkey(id, username, display_name, bio, avatar_url, banner_url, website, is_private, deactivated_at, created_at, updated_at),
       community:communities(slug, name)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
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
    .select("conversation_id, last_read_at, conversation:conversations(id, last_message_at)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const summaries = await Promise.all(
    memberships.map(async (membership: any) => {
      const conversationId = membership.conversation_id as string;
      const [{ data: otherMembers }, { data: lastMessages }, { count: unread }] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("user:profiles!conversation_members_user_id_fkey(*)")
          .eq("conversation_id", conversationId)
          .neq("user_id", userId)
          .limit(1),
        supabase
          .from("messages")
          .select("body")
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

      return {
        id: conversationId,
        last_message_at: membership.conversation?.last_message_at ?? new Date().toISOString(),
        other: (otherMembers?.[0]?.user ?? null) as Profile | null,
        last_message: lastMessages?.[0]?.body ?? null,
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
      .select("role")
      .eq("community_id", community.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    community.is_member = Boolean(membership);
    community.my_role = (membership as any)?.role ?? null;
  }
  return community;
}
