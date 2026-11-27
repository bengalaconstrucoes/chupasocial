export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  website: string | null;
  location: string | null;
  accent_color: string | null;
  name_font: string;
  is_verified: boolean;
  is_admin?: boolean;
  flag: string | null;
  status_text: string | null;
  status_emoji: string | null;
  favorite_song: string | null;
  favorite_song_artist: string | null;
  song_url?: string | null;
  avatar_frame?: string | null;
  banner_focus?: number | null;
  hidden_badges?: string[] | null;
  song_text_color?: string | null;
  song_bubble_color?: string | null;
  muted_until?: string | null;
  suspended_until?: string | null;
  pinned_post_id: string | null;
  show_stats: boolean;
  show_visits: boolean;
  profile_style: "modern" | "y2k";
  last_seen_at: string | null;
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
  media_type: "image" | "gif" | "video";
};

export type Post = {
  id: string;
  author_id: string;
  community_id: string | null;
  repost_of: string | null;
  root_post_id: string | null;
  parent_post_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type PostPoll = {
  options: Array<{ id: string; label: string; count: number }>;
  my_vote: string | null;
  total: number;
};

export type FeedPost = Post & {
  author: Profile;
  media: PostMedia[];
  like_count: number;
  comment_count: number;
  repost_count: number;
  view_count: number;
  liked_by_me: boolean;
  reposted_by_me: boolean;
  saved_by_me: boolean;
  community: { id: string; slug: string; name: string } | null;
  reposted_post?: FeedPost | null;
  /** Publicação respondida, mostrada acima da resposta (estilo Twitter). */
  parent_post?: FeedPost | null;
  collaborators?: Array<Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "is_verified">>;
  poll?: PostPoll | null;
};

// Respostas são publicações: herdam curtidas, reposts, mídia e menções.
export type CommentItem = FeedPost & { replies: CommentItem[] };

export type NotificationItem = {
  id: string;
  type:
    | "follow"
    | "follow_request"
    | "like"
    | "comment"
    | "reply"
    | "repost"
    | "mention"
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
  banner_url?: string | null;
  banner_focus?: number | null;
  is_private?: boolean;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
  my_role?: "owner" | "moderator" | "member" | null;
  my_status?: "pending" | "active" | null;
  requires_approval?: boolean;
  emojis?: string[];
  invite_token?: string;
};

export type ConversationSummary = {
  id: string;
  last_message_at: string;
  title: string | null;
  is_group: boolean;
  members: Profile[];
  other: Profile | null;
  last_message: string | null;
  unread_count: number;
};

export type MessageAttachment = {
  url: string;
  previewUrl: string;
  type: "image" | "gif" | "audio";
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_preview_url: string | null;
  attachment_type: "image" | "gif" | "audio" | null;
  view_once: boolean;
  expires_at: string | null;
  created_at: string;
};

export type GifItem = {
  id: string;
  provider: string;
  title: string;
  url: string;
  preview: string;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
