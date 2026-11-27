"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownRight, Loader2, Reply } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostActions } from "@/components/post-actions";
import { PostMediaGrid } from "@/components/media-lightbox";
import { RichText } from "@/components/rich-text";
import { addCommentAction } from "@/lib/actions/posts";
import { nameFontClass } from "@/lib/profile-style";
import { cn, timeAgo } from "@/lib/utils";
import type { CommentItem, Profile } from "@/lib/types";

function countReplies(items: CommentItem[]): number {
  return items.reduce((total, item) => total + 1 + countReplies(item.replies), 0);
}

function ReplyNode({
  reply,
  viewerId,
  onReply,
  depth = 0,
}: {
  reply: CommentItem;
  viewerId: string;
  onReply: (reply: CommentItem) => void;
  depth?: number;
}) {
  const author = reply.author;

  return (
    <li className="flex gap-2.5">
      <Avatar profile={author} size={depth > 0 ? 26 : 32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          {author ? (
            <Link
              href={`/u/${author.username}`}
              className={cn("font-semibold hover:underline", nameFontClass(author.name_font))}
            >
              {author.display_name}
            </Link>
          ) : (
            <span className="font-semibold">Alguém</span>
          )}
          {author && <span className="text-xs text-muted">@{author.username}</span>}
          <Link href={`/post/${reply.id}`} className="text-xs text-muted hover:underline">
            · {timeAgo(reply.created_at)}
          </Link>
          {reply.edited_at && <span className="text-[0.68rem] text-muted">(editado)</span>}
        </div>

        {reply.content && (
          <p className="prose-chupa mt-0.5 text-sm leading-relaxed">
            <RichText text={reply.content} />
          </p>
        )}

        <PostMediaGrid media={reply.media} authorName={author?.display_name ?? "alguém"} />

        <div className="mt-1">
          <PostActions
            postId={reply.id}
            likeCount={reply.like_count}
            commentCount={reply.comment_count}
            repostCount={reply.repost_count}
            liked={reply.liked_by_me}
            reposted={reply.reposted_by_me}
            isOwner={reply.author_id === viewerId}
            canEdit={false}
            content={reply.content}
            showRepost
          />
        </div>

        <button
          type="button"
          onClick={() => onReply(reply)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
        >
          <CornerDownRight size={12} /> Responder
        </button>

        {reply.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l border-line pl-3">
            {reply.replies.map((child) => (
              <ReplyNode
                key={child.id}
                reply={child}
                viewerId={viewerId}
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function Comments({
  postId,
  comments,
  viewerId,
  viewer,
}: {
  postId: string;
  comments: CommentItem[];
  viewerId: string;
  viewer: Profile;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = countReplies(comments);

  function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addCommentAction(postId, trimmed, replyTo?.id ?? null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setContent("");
      setReplyTo(null);
      setError(null);
      router.refresh();
    });
  }

  function startReply(reply: CommentItem) {
    setReplyTo(reply);
    document
      .getElementById(`reply-box-${postId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(`reply-input-${postId}`)?.focus();
  }

  return (
    <section id={`comments-${postId}`} className="border-t border-line bg-surface px-4 py-4 sm:px-5">
      <h2 className="text-sm font-semibold">
        Respostas {total > 0 && <span className="text-muted">({total})</span>}
      </h2>

      <form
        id={`reply-box-${postId}`}
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {replyTo && (
          <div className="mb-1.5 flex items-center justify-between rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
            <span>Respondendo @{replyTo.author?.username ?? "alguém"}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="hover:text-ink">
              cancelar
            </button>
          </div>
        )}
        <div className="flex gap-2.5">
          <Avatar profile={viewer} size={30} />
          <div className="flex-1">
            <textarea
              id={`reply-input-${postId}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={replyTo ? "Escreva sua resposta…" : "Escreva uma resposta…"}
              rows={2}
              maxLength={1000}
              className="field resize-none text-sm"
              aria-label="Resposta"
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {error}
              </p>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-[0.68rem] text-muted">
                Use #assunto e @usuario — as duas coisas ficam clicáveis.
              </p>
              <button
                type="submit"
                className={cn("btn btn-primary !px-3.5 !py-1.5 text-xs")}
                disabled={pending || !content.trim()}
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {replyTo ? "Responder" : "Publicar resposta"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted">
          <Reply size={13} /> Comece a conversa. Boa conversa começa aqui.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((comment) => (
            <ReplyNode
              key={comment.id}
              reply={comment}
              viewerId={viewerId}
              onReply={startReply}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
