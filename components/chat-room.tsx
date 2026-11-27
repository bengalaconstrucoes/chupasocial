"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Clock3, Loader2, SendHorizonal, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Ducky } from "@/components/ducky";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction, type ChatMessage } from "@/lib/actions/chat";
import { cn, timeAgo } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

type Viewer = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_frame?: string | null;
};

function expiresIn(createdAt: string, now: number) {
  const left = new Date(createdAt).getTime() + DAY - now;
  if (left <= 0) return "expirada";
  const hours = Math.floor(left / (60 * 60 * 1000));
  const minutes = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 1) return `some em ${hours}h`;
  return `some em ${Math.max(1, minutes)} min`;
}

export function ChatRoom({
  initialMessages,
  viewer,
}: {
  initialMessages: ChatMessage[];
  viewer: Viewer;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => messages.filter((item) => new Date(item.created_at).getTime() + DAY > now),
    [messages, now],
  );

  // Relógio local: a mensagem some da tela quando completa 24 h, mesmo sem F5.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function scrollToBottom(smooth = false) {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  useEffect(() => {
    scrollToBottom();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chupa-chat-24h")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            author_id: string;
            body: string;
            created_at: string;
          };
          if (!row?.id) return;

          let author: ChatMessage["author"] = null;
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

          setMessages((current) =>
            current.some((item) => item.id === row.id)
              ? current
              : [...current, { ...row, author }],
          );
          requestAnimationFrame(() => scrollToBottom(true));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old?.id) return;
          setMessages((current) => current.filter((item) => item.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [viewer]);

  function send() {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await sendChatMessageAction(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setMessages((current) =>
        current.some((item) => item.id === result.message.id)
          ? current
          : [...current, result.message],
      );
      requestAnimationFrame(() => scrollToBottom(true));
    });
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[0.72rem] text-muted">
        <Clock3 size={13} className="text-accent" />
        <span>
          Sala pública das últimas 24 horas. Cada mensagem é <strong>apagada sozinha</strong> ao
          completar um dia.
        </span>
        <span className="ml-auto font-semibold text-ink">{visible.length} na sala</span>
      </div>

      <div
        ref={listRef}
        className="chupa-card flex h-[58vh] min-h-[320px] flex-col overflow-y-auto p-3"
      >
        {visible.length === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <Ducky tip="A sala abre vazia todo dia. Manda a primeira mensagem e puxa o papo." />
            <p className="mt-3 text-sm font-semibold">Ninguém falou nada nas últimas 24 horas.</p>
            <p className="mt-1 text-xs text-muted">Seja a primeira pessoa a escrever.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((message) => {
              const mine = message.author_id === viewer.id;
              return (
                <li
                  key={message.id}
                  className={cn("flex items-start gap-2", mine && "flex-row-reverse")}
                >
                  <Avatar
                    profile={
                      message.author
                        ? {
                            username: message.author.username,
                            display_name: message.author.display_name,
                            avatar_url: message.author.avatar_url,
                            avatar_frame: message.author.avatar_frame,
                          }
                        : null
                    }
                    size={32}
                    link={Boolean(message.author)}
                  />
                  <div
                    className={cn(
                      "min-w-0 max-w-[85%] rounded-2xl px-3 py-2",
                      mine
                        ? "rounded-tr-sm bg-accent-soft text-ink"
                        : "rounded-tl-sm bg-surface-2",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-1.5 text-[0.68rem] text-muted">
                      <span className="font-semibold text-ink">
                        {message.author?.display_name ?? "Alguém"}
                      </span>
                      <span>@{message.author?.username ?? "removido"}</span>
                      <span>· {timeAgo(message.created_at)}</span>
                      <span className="ml-auto inline-flex items-center gap-0.5 text-[0.6rem] opacity-80">
                        <Trash2 size={9} /> {expiresIn(message.created_at, now)}
                      </span>
                    </div>
                    <p className="prose-chupa mt-0.5 text-sm leading-relaxed">{message.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
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
          maxLength={500}
          placeholder="Manda o papo… (Enter envia, Shift+Enter quebra linha)"
          className="field max-h-28 flex-1 resize-none text-sm"
          aria-label="Sua mensagem no chat"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="btn btn-primary !h-10 !w-10 !p-0"
          aria-label="Enviar mensagem"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-[0.68rem] text-muted">
        <span>Sua mensagem aparece para todo mundo que está no chat agora.</span>
        <span>{body.length}/500</span>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
