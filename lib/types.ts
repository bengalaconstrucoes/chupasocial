export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  website: string | null;
  is_private: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostMedia = {
  id: string;
  storage_path: string;
  public_url: string;
  position: number;
};

export type Post = {
  id: string;
  author_id: string;
  community_id: string | null;
  repost_of: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type FeedPost = Post & {
  author: Profile;
  media: PostMedia[];
  like_count: number;
  comment_count: number;
  repost_count: number;
  liked_by_me: boolean;
  reposted_by_me: boolean;
  community: { id: string; slug: string; name: string } | null;
  reposted_post?: FeedPost | null;
};

export type CommentItem = {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: Profile;
  replies?: CommentItem[];
};

export type NotificationItem = {
  id: string;
  type:
    | "follow"
    | "follow_request"
    | "like"
    | "comment"
    | "reply"
    | "repost"
    | "message"
    | "community";
  read_at: string | null;
  created_at: string;
  actor: Profile | null;
  post_id: string | null;
  comment_id: string | null;
  conversation_id: string | null;
  community_id: string | null;
  community: { slug: string; name: string } | null;
};

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
  my_role?: "owner" | "moderator" | "member" | null;
};

export type ConversationSummary = {
  id: string;
  last_message_at: string;
  other: Profile | null;
  last_message: string | null;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
