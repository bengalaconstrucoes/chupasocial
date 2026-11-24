"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { markConversationReadAction, sendMessageAction } from "@/lib/actions/messages";
import { cn, formatTime } from "@/lib/utils";
import type { Message, Profile } from "@/lib/types";

export function MessageThread({
  conversationId,
  viewerId,
  initialMessages,
  other,
}: {
  conversationId: string;
  viewerId: string;
  initialMessages: Message[];
  other: Profile | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chupa-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          );
          void markConversationReadAction(conversationId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setBody("");

    const result = await sendMessageAction(conversationId, trimmed);
    if (!result.ok) {
      setError(result.error);
      setBody(trimmed);
    } else {
      router.refresh();
    }
    setSending(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">Comece a conversa</p>
            <p className="mt-1 text-xs text-muted">
              As mensagens ficam salvas no histórico e chegam em tempo real.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const mine = message.sender_id === viewerId;
          const previous = messages[index - 1];
          const grouped = previous?.sender_id === message.sender_id;
          return (
            <div
              key={message.id}
              className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
            >
              {!mine && (
                <span className={cn("w-7 shrink-0", grouped && "invisible")}>
                  <Avatar profile={other} size={28} link={false} />
                </span>
              )}
              <div
                className={cn(
                  "animate-pop max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  mine
                    ? "rounded-br-md bg-accent text-accent-ink"
                    : "rounded-bl-md bg-surface-2 text-ink",
                )}
              >
                <p className="prose-chupa">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[0.62rem]",
                    mine ? "text-accent-ink/70" : "text-muted",
                  )}
                >
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="border-t border-line px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <form
        className="sticky bottom-0 border-t border-line bg-surface px-3 py-3 sm:px-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Escreva uma mensagem"
            className="field max-h-32 flex-1 resize-none text-sm"
            aria-label="Mensagem"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="btn btn-primary !h-10 !w-10 !p-0"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
        <p className="mt-1 text-[0.65rem] text-muted">Enter envia · Shift+Enter quebra linha</p>
      </form>
    </div>
  );
}
