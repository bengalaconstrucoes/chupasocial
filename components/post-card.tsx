import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostActions } from "@/components/post-actions";
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

  return (
    <article className={cn("px-4 py-3.5 sm:px-5", embedded && "rounded-xl border border-line bg-bg px-3.5 py-3")}>
      <header className="flex items-start gap-3">
        <Avatar profile={post.author} size={embedded ? 32 : 40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            <Link
              href={`/u/${post.author.username}`}
              className="truncate font-semibold hover:underline"
            >
              {post.author.display_name}
            </Link>
            {post.author.is_private && <Lock size={12} className="text-muted" aria-label="Perfil privado" />}
            <span className="truncate text-muted">@{post.author.username}</span>
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
        </div>
      </header>

      {post.content && (
        <p className="prose-chupa mt-2 text-[0.98rem] leading-relaxed">{post.content}</p>
      )}

      {post.media.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-1 overflow-hidden rounded-xl border border-line",
            post.media.length === 1
              ? "grid-cols-1"
              : post.media.length === 2
                ? "grid-cols-2"
                : "grid-cols-2",
          )}
        >
          {post.media.map((media, index) => (
            <a
              key={media.id}
              href={media.public_url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "block bg-surface-2",
                post.media.length === 3 && index === 0 && "col-span-2",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.public_url}
                alt={`Imagem ${index + 1} da publicação de ${post.author.display_name}`}
                loading="lazy"
                className={cn(
                  "w-full object-cover",
                  post.media.length === 1 ? "max-h-[520px]" : "h-56",
                )}
              />
            </a>
          ))}
        </div>
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
  const isRepost = Boolean(post.repost_of && post.reposted_post);
  const inner = post.reposted_post;

  return (
    <article className="border-b border-line bg-surface transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_92%,var(--surface-2))]">
      {isRepost && inner && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[0.72rem] text-muted sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Avatar profile={post.author} size={16} link={false} />
            <Link href={`/u/${post.author.username}`} className="font-medium hover:underline">
              {post.author.display_name}
            </Link>
            <span>repostou</span>
          </span>
          <Link href={`/post/${post.id}`} className="hover:underline">
            {timeAgo(post.created_at)}
          </Link>
        </div>
      )}

      {isRepost && inner ? (
        <div className="px-3 pb-3 pt-2 sm:px-4">
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
            />
          </div>
        </div>
      ) : (
        <PostBody post={post} viewerId={viewerId} detail={detail} />
      )}
    </article>
  );
}
