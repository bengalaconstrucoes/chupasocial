"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownRight, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { addCommentAction, deleteCommentAction } from "@/lib/actions/posts";
import { cn, timeAgo } from "@/lib/utils";
import type { CommentItem } from "@/lib/types";

function CommentNode({
  comment,
  viewerId,
  onReply,
  onDelete,
  busy,
}: {
  comment: CommentItem;
  viewerId: string;
  onReply: (comment: CommentItem) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      <Avatar profile={comment.author} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link href={`/u/${comment.author.username}`} className="font-semibold hover:underline">
            {comment.author.display_name}
          </Link>
          <span className="text-xs text-muted">@{comment.author.username}</span>
          <span className="text-xs text-muted">· {timeAgo(comment.created_at)}</span>
        </div>
        <p className="prose-chupa mt-0.5 text-sm leading-relaxed">{comment.content}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted">
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="inline-flex items-center gap-1 hover:text-accent"
          >
            <CornerDownRight size={12} /> Responder
          </button>
          {comment.author.id === viewerId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(comment.id)}
              className="inline-flex items-center gap-1 hover:text-danger"
            >
              <Trash2 size={12} /> Excluir
            </button>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l border-line pl-3">
            {comment.replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                viewerId={viewerId}
                onReply={onReply}
                onDelete={onDelete}
                busy={busy}
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
  viewer: { username: string; display_name: string; avatar_url: string | null };
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCommentAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section id={`comments-${postId}`} className="border-t border-line bg-surface px-4 py-4 sm:px-5">
      <h2 className="text-sm font-semibold">
        Comentários {comments.length > 0 && <span className="text-muted">({comments.length})</span>}
      </h2>

      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {replyTo && (
          <div className="mb-1.5 flex items-center justify-between rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
            <span>Respondendo @{replyTo.author.username}</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="hover:text-ink"
            >
              cancelar
            </button>
          </div>
        )}
        <div className="flex gap-2.5">
          <Avatar profile={viewer as any} size={30} />
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={replyTo ? "Escreva sua resposta…" : "Escreva um comentário…"}
              rows={2}
              maxLength={1000}
              className="field resize-none text-sm"
              aria-label="Comentário"
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {error}
              </p>
            )}
            <div className="mt-1.5 flex justify-end">
              <button
                type="submit"
                className={cn("btn btn-primary !px-3.5 !py-1.5 text-xs")}
                disabled={pending || !content.trim()}
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {replyTo ? "Responder" : "Comentar"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Seja a primeira pessoa a comentar. Conversa boa começa aqui.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              viewerId={viewerId}
              onReply={setReplyTo}
              onDelete={remove}
              busy={pending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
