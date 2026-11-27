"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  replyAnnouncementAction,
  type AnnouncementReply,
} from "@/lib/actions/announcements";
import { cn, timeAgo } from "@/lib/utils";

type Viewer = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_frame?: string | null;
};

export function AnnouncementRoom({
  announcementId,
  initialReplies,
  viewer,
  canReply,
}: {
  announcementId: string;
  initialReplies: AnnouncementReply[];
  viewer: Viewer;
  canReply: boolean;
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReplies(initialReplies), [initialReplies]);

  // Tempo real: qualquer pessoa na página vê a resposta chegar.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chupa-announcement-${announcementId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcement_replies",
          filter: `announcement_id=eq.${announcementId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            announcement_id: string;
            author_id: string;
            body: string;
            created_at: string;
          };
          if (!row?.id) return;

          let author: AnnouncementReply["author"] = null;
          if (row.author_id === viewer.id) {
            author = {
              username: viewer.username,
              display_name: viewer.display_name,
              avatar_url: viewer.avatar_url,
              avatar_frame: viewer.avatar_frame ?? null,
            };
          } else {
            const { data } = await supabase
              .from("profiles")
              .select("username, display_name, avatar_url, avatar_frame")
              .eq("id", row.author_id)
              .maybeSingle();
            author = data ?? null;
          }

          setReplies((current) =>
            current.some((reply) => reply.id === row.id)
              ? current
              : [...current, { ...row, author }],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [announcementId, viewer]);

  function send() {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await replyAnnouncementAction(announcementId, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setReplies((current) =>
        current.some((reply) => reply.id === result.reply.id)
          ? current
          : [...current, result.reply],
      );
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
    });
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
        {replies.length === 0 ? "sem respostas ainda" : `${replies.length} respostas`}
      </p>

      {replies.length > 0 && (
        <ul className="mt-2 space-y-2.5">
          {replies.map((reply) => (
            <li key={reply.id} className="flex items-start gap-2">
              <Avatar
                profile={
                  reply.author
                    ? {
                        username: reply.author.username,
                        display_name: reply.author.display_name,
                        avatar_url: reply.author.avatar_url,
                        avatar_frame: reply.author.avatar_frame,
                      }
                    : null
                }
                size={28}
                link={Boolean(reply.author)}
              />
              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-1.5 text-[0.7rem] text-muted">
                  <span className="font-semibold text-ink">
                    {reply.author?.display_name ?? "Alguém"}
                  </span>
                  <span>@{reply.author?.username ?? "removido"}</span>
                  <span className="ml-auto">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="prose-chupa mt-0.5 text-sm leading-relaxed">{reply.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canReply ? (
        <div className="mt-2.5 flex items-end gap-1.5">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Responder no fórum…"
            className="field max-h-28 flex-1 resize-none text-sm"
            aria-label="Sua resposta"
          />
          <button
            type="button"
            onClick={send}
            disabled={pending || !body.trim()}
            className={cn("btn btn-primary !h-9 !w-9 !p-0")}
            aria-label="Enviar resposta"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Entre para responder.</p>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div ref={endRef} />
    </div>
  );
}
