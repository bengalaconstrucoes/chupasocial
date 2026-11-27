import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/badges";
import { PostActions } from "@/components/post-actions";
import { PostMediaGrid } from "@/components/media-lightbox";
import { PollBlock } from "@/components/poll-block";
import { RichText } from "@/components/rich-text";
import { nameFontClass } from "@/lib/profile-style";
import { cn, timeAgo } from "@/lib/utils";
import type { FeedPost } from "@/lib/types";

function PostBody({
  post,
  viewerId,
  detail,
  embedded = false,
}: {
  post: FeedPost;
  viewerId: string;
  detail: boolean;
  embedded?: boolean;
}) {
  const isOwner = post.author_id === viewerId;
  const canEdit = false;
  const author = post.author;

  // Linha sem autor visível (perfil removido/invisível por RLS): não derruba a página.
  if (!author) return null;

  return (
    <article className={cn("px-4 py-3.5 sm:px-5", embedded && "rounded-xl border border-line bg-bg px-3.5 py-3")}>
      <header className="flex items-start gap-3">
        <Avatar profile={author} size={embedded ? 32 : 40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            <Link
              href={`/u/${author.username}`}
              className={cn("truncate font-semibold hover:underline", nameFontClass(author.name_font))}
            >
              {author.display_name}
            </Link>
            {author.is_verified && <VerifiedBadge size={14} />}
            {author.is_private && <Lock size={12} className="text-muted" aria-label="Perfil privado" />}
            <span className="truncate text-muted">@{author.username}</span>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <Link
              href={`/post/${post.id}`}
              className="text-muted hover:text-ink hover:underline"
              title={new Date(post.created_at).toLocaleString("pt-BR")}
            >
              {timeAgo(post.created_at)}
            </Link>
            {post.edited_at && <span className="text-xs text-muted">(editado)</span>}
          </div>

          {post.community && (
            <Link
              href={`/communities/${post.community.slug}`}
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-medium text-muted hover:text-accent"
            >
              <Users size={11} /> {post.community.name}
            </Link>
          )}

          {post.collaborators && post.collaborators.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-[0.7rem] text-muted">
              <Users size={11} /> com
              {post.collaborators.map((person, index) => (
                <span key={person.id} className="inline-flex items-center gap-0.5">
                  <Link href={`/u/${person.username}`} className="font-medium text-accent hover:underline">
                    @{person.username}
                  </Link>
                  {person.is_verified && <VerifiedBadge size={10} />}
                  {index < post.collaborators!.length - 1 ? "," : ""}
                </span>
              ))}
            </p>
          )}
        </div>
      </header>

      {post.content && (
        <p className="prose-chupa mt-2 text-[0.98rem] leading-relaxed">
          <RichText text={post.content} />
        </p>
      )}

      <PostMediaGrid media={post.media} authorName={author.display_name} />

      {post.poll && post.poll.options.length > 0 && (
        <PollBlock postId={post.id} initial={post.poll} />
      )}

      {!embedded && (
        <PostActions
          postId={post.id}
          likeCount={post.like_count}
          commentCount={post.comment_count}
          repostCount={post.repost_count}
          liked={post.liked_by_me}
          reposted={post.reposted_by_me}
          isOwner={isOwner}
          canEdit={canEdit}
          content={post.content}
          showRepost={!post.repost_of}
          saved={post.saved_by_me}
          isPinned={author.pinned_post_id === post.id}
          canPin={isOwner && !post.root_post_id && !post.repost_of}
        />
      )}

      {detail && !embedded && (
        <p className="mt-2 text-xs text-muted">
          {new Date(post.created_at).toLocaleString("pt-BR")}
        </p>
      )}
    </article>
  );
}

export function PostCard({
  post,
  viewerId,
  detail = false,
}: {
  post: FeedPost;
  viewerId: string;
  detail?: boolean;
}) {
  const isRepost = Boolean(post.repost_of);
  const inner = post.reposted_post;

  return (
    <article className="border-b border-line bg-surface transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_92%,var(--surface-2))]">
      {isRepost && inner && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[0.72rem] text-muted sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Avatar profile={post.author} size={16} link={false} />
            <Link
              href={`/u/${post.author.username}`}
              className={cn("font-medium hover:underline", nameFontClass(post.author.name_font))}
            >
              {post.author.display_name}
            </Link>
            <span>repostou</span>
          </span>
          <Link href={`/post/${post.id}`} className="hover:underline">
            {timeAgo(post.created_at)}
          </Link>
        </div>
      )}

      {isRepost && !inner ? (
        <p className="px-4 py-4 text-sm text-muted sm:px-5">
          A publicação original foi removida ou não está disponível.
        </p>
      ) : isRepost && inner ? (
        <div className="px-3 pb-3 pt-2 sm:px-4">
          {post.content && (
            <p className="prose-chupa mb-2 px-1 text-[0.95rem] leading-relaxed">
              <RichText text={post.content} />
            </p>
          )}
          <PostBody post={inner} viewerId={viewerId} detail={false} embedded />
          <div className="mt-2 px-1">
            <PostActions
              postId={post.id}
              likeCount={post.like_count}
              commentCount={post.comment_count}
              repostCount={post.repost_count}
              liked={post.liked_by_me}
              reposted={post.reposted_by_me}
              isOwner={post.author_id === viewerId}
              canEdit={false}
              content=""
              showRepost={false}
              saved={post.saved_by_me}
            />
          </div>
        </div>
      ) : (
        <PostBody post={post} viewerId={viewerId} detail={detail} />
      )}
    </article>
  );
}
