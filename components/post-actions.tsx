"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Share2,
  Trash2,
} from "lucide-react";
import {
  deletePostAction,
  toggleLikeAction,
  toggleRepostAction,
  updatePostAction,
} from "@/lib/actions/posts";
import { cn, formatCount } from "@/lib/utils";

type Props = {
  postId: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  liked: boolean;
  reposted: boolean;
  isOwner: boolean;
  content: string;
  canEdit: boolean;
  showRepost?: boolean;
};

export function PostActions({
  postId,
  likeCount,
  commentCount,
  repostCount,
  liked,
  reposted,
  isOwner,
  content,
  canEdit,
  showRepost = true,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState({
    liked,
    likeCount,
    reposted,
    repostCount,
    commentCount,
  });
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 2200);
  }

  function onLike() {
    const nextLiked = !state.liked;
    setState((current) => ({
      ...current,
      liked: nextLiked,
      likeCount: current.likeCount + (nextLiked ? 1 : -1),
    }));

    startTransition(async () => {
      const result = await toggleLikeAction(postId, nextLiked);
      if (!result.ok) {
        setState((current) => ({
          ...current,
          liked: !nextLiked,
          likeCount: current.likeCount + (nextLiked ? -1 : 1),
        }));
        flash(result.error);
      }
    });
  }

  function onRepost() {
    const nextReposted = !state.reposted;
    setState((current) => ({
      ...current,
      reposted: nextReposted,
      repostCount: current.repostCount + (nextReposted ? 1 : -1),
    }));

    startTransition(async () => {
      const result = await toggleRepostAction(postId, nextReposted);
      if (!result.ok) {
        setState((current) => ({
          ...current,
          reposted: !nextReposted,
          repostCount: current.repostCount + (nextReposted ? -1 : 1),
        }));
        flash(result.error);
        return;
      }
      router.refresh();
      flash(nextReposted ? "Repostado" : "Repost removido");
    });
  }

  async function onShare() {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "ChupaSocial" });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Link copiado!");
    } catch {
      flash("Não foi possível copiar o link.");
    }
  }

  function focusComment() {
    const element = document.getElementById(`comments-${postId}`);
    if (!element) {
      router.push(`/post/${postId}`);
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      flash("O texto não pode ficar vazio.");
      return;
    }
    startTransition(async () => {
      const result = await updatePostAction(postId, trimmed);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
      flash("Publicação editada");
    });
  }

  function confirmRemove() {
    startTransition(async () => {
      const result = await deletePostAction(postId);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-1">
      {editing ? (
        <div className="mb-2 space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={2000}
            className="field text-sm"
            aria-label="Editar publicação"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending}
              className="btn btn-primary !px-3 !py-1.5 text-xs"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(content);
              }}
              className="btn btn-ghost !px-3 !py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-0.5 text-muted">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={state.liked}
          aria-label={state.liked ? "Remover curtida" : "Curtir"}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-accent-soft",
            state.liked && "text-accent",
          )}
        >
          <Heart size={17} className={state.liked ? "fill-current" : ""} />
          <span className="tabular-nums">{state.likeCount > 0 ? formatCount(state.likeCount) : ""}</span>
        </button>

        <button
          type="button"
          onClick={focusComment}
          aria-label="Comentar"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MessageCircle size={17} />
          <span className="tabular-nums">{state.commentCount > 0 ? formatCount(state.commentCount) : ""}</span>
        </button>

        {showRepost && (
          <button
            type="button"
            onClick={onRepost}
            aria-pressed={state.reposted}
            aria-label={state.reposted ? "Desfazer repost" : "Repostar"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-ok",
              state.reposted && "text-ok",
            )}
          >
            <Repeat2 size={17} />
            <span className="tabular-nums">{state.repostCount > 0 ? formatCount(state.repostCount) : ""}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onShare}
          aria-label="Compartilhar"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Share2 size={16} />
        </button>

        {(isOwner || canEdit) && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-full p-1.5 hover:bg-surface-2 hover:text-ink"
              aria-label="Mais opções"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={17} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-lg">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-surface-2"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {pending && <Loader2 size={13} className="ml-1 animate-spin" aria-hidden />}
        {notice && (
          <span role="status" className="ml-1 truncate text-[0.7rem] text-muted">
            {notice}
          </span>
        )}
      </div>

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="Confirmar exclusão"
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"
        >
          <span>Excluir esta publicação definitivamente?</span>
          <button
            type="button"
            onClick={confirmRemove}
            disabled={pending}
            className="btn btn-danger !px-2.5 !py-1 text-xs"
          >
            Excluir
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="btn btn-ghost !px-2.5 !py-1 text-xs"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
