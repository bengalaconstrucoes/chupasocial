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
  Pin,
  PinOff,
  Quote,
  Repeat2,
  Share2,
  Trash2,
} from "lucide-react";
import {
  deletePostAction,
  quoteRepostAction,
  toggleLikeAction,
  toggleRepostAction,
  updatePostAction,
} from "@/lib/actions/posts";
import { togglePinnedPostAction } from "@/lib/actions/features";
import { ReportDialog } from "@/components/report-dialog";
import { SavedPostButton } from "@/components/saved-post-button";
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
  saved?: boolean;
  isPinned?: boolean;
  canPin?: boolean;
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
  saved = false,
  isPinned = false,
  canPin = false,
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
  const [repostOpen, setRepostOpen] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState("");
  const [pinned, setPinned] = useState(isPinned);

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

  function publishQuote() {
    const trimmed = quoteDraft.trim();
    if (!trimmed) {
      flash("Escreva um comentário para citar.");
      return;
    }

    startTransition(async () => {
      const result = await quoteRepostAction(postId, trimmed);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setQuoting(false);
      setQuoteDraft("");
      router.refresh();
      flash("Citação publicada");
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

  function togglePin() {
    const next = !pinned;
    setMenuOpen(false);
    startTransition(async () => {
      const result = await togglePinnedPostAction(next ? postId : null);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setPinned(next);
      router.refresh();
      flash(next ? "Publicação fixada no perfil" : "Publicação desafixada");
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setRepostOpen((value) => !value)}
              aria-pressed={state.reposted}
              aria-label="Repostar ou citar"
              aria-expanded={repostOpen}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-ok",
                state.reposted && "text-ok",
              )}
            >
              <Repeat2 size={17} />
              <span className="tabular-nums">{state.repostCount > 0 ? formatCount(state.repostCount) : ""}</span>
            </button>
            {repostOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-1 w-44 overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setRepostOpen(false);
                    onRepost();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                >
                  <Repeat2 size={14} />
                  {state.reposted ? "Desfazer repost" : "Repostar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepostOpen(false);
                    setQuoting(true);
                  }}
                  className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left hover:bg-surface-2"
                >
                  <Quote size={14} /> Citar publicação
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onShare}
          aria-label="Compartilhar"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Share2 size={16} />
        </button>

        <SavedPostButton postId={postId} initialSaved={saved} />

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
                {isOwner && canPin && (
                  <button
                    type="button"
                    onClick={togglePin}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                  >
                    {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    {pinned ? "Desafixar do perfil" : "Fixar no perfil"}
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
                {!isOwner && (
                  <div className="border-t border-line px-1 py-1">
                    <ReportDialog
                      targetType="post"
                      targetId={postId}
                      label="Denunciar publicação"
                      className="w-full"
                    />
                  </div>
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

      {quoting && (
        <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface-2 p-2.5">
          <textarea
            value={quoteDraft}
            onChange={(event) => setQuoteDraft(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Adicione um comentário a esta citação"
            className="field text-sm"
            aria-label="Comentário da citação"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={publishQuote}
              disabled={pending || !quoteDraft.trim()}
              className="btn btn-primary !px-3 !py-1.5 text-xs"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Quote size={13} />}
              Publicar citação
            </button>
            <button
              type="button"
              onClick={() => {
                setQuoting(false);
                setQuoteDraft("");
              }}
              className="btn btn-ghost !px-3 !py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
