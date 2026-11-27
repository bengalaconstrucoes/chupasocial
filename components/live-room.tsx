"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Loader2, Radio, Send, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { endLiveRoomAction } from "@/lib/actions/live-rooms";
import type { Profile } from "@/lib/types";

type Participant = { userId: string; name: string; username: string };

type ChatMessage = {
  id: string;
  name: string;
  username: string;
  body: string;
  at: number;
};

export function LiveRoom({
  roomId,
  title,
  communitySlug,
  viewer,
  isHost,
  isLive,
}: {
  roomId: string;
  title: string;
  communitySlug: string;
  viewer: Pick<Profile, "id" | "display_name" | "username">;
  isHost: boolean;
  isLive: boolean;
}) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLive) return;

    const supabase = createClient();
    const channel = supabase.channel(`live-room:${roomId}`, {
      config: { presence: { key: viewer.id } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const message = payload as ChatMessage;
        if (!message?.body) return;
        setMessages((current) => [...current.slice(-99), message]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: Participant[] = [];
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (!entry?.userId) continue;
            if (list.some((person) => person.userId === entry.userId)) continue;
            list.push({ userId: entry.userId, name: entry.name, username: entry.username });
          }
        }
        setPeople(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({
            userId: viewer.id,
            name: viewer.display_name,
            username: viewer.username,
          });
        } else {
          setConnected(false);
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [isLive, roomId, viewer.display_name, viewer.id, viewer.username]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function send() {
    const body = text.trim();
    if (!body || !channelRef.current) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      name: viewer.display_name,
      username: viewer.username,
      body: body.slice(0, 500),
      at: Date.now(),
    };
    setText("");
    setMessages((current) => [...current.slice(-99), message]);
    void channelRef.current.send({ type: "broadcast", event: "message", payload: message });
  }

  async function end() {
    setError(null);
    setEnding(true);
    const result = await endLiveRoomAction(roomId);
    setEnding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/communities/${communitySlug}`);
    router.refresh();
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-danger">
            <Radio size={11} /> {isLive ? "ao vivo" : "encerrada"}
          </span>
          <h1 className="text-base font-semibold">{title}</h1>
          {isHost && isLive && (
            <button
              type="button"
              onClick={end}
              disabled={ending}
              className="btn btn-quiet ml-auto !px-2.5 !py-1 text-xs text-danger"
            >
              {ending ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />}
              encerrar sala
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {connected
            ? `${people.length} ${people.length === 1 ? "pessoa" : "pessoas"} na sala`
            : isLive
              ? "conectando…"
              : "Esta sala foi encerrada pela pessoa anfitriã."}
        </p>
      </div>

      {isLive && (
        <div className="flex flex-wrap gap-1.5 border-b border-line bg-surface px-4 py-2 sm:px-5">
          {people.length === 0 ? (
            <span className="text-[0.7rem] text-muted">Ninguém por aqui ainda.</span>
          ) : (
            people.map((person) => (
              <span
                key={person.userId}
                className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.7rem] text-muted"
              >
                {person.name}
              </span>
            ))
          )}
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-4 sm:px-5"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            {isLive ? "A sala está aberta. Mande a primeira mensagem." : "Sem mensagens."}
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="max-w-[85%] rounded-xl bg-surface px-3 py-2">
              <p className="text-[0.68rem] font-medium text-accent">{message.name}</p>
              <p className="text-sm">{message.body}</p>
            </div>
          ))
        )}
      </div>

      {isLive && (
        <div className="flex items-center gap-2 border-t border-line bg-surface px-4 py-3 pb-20 sm:px-5 lg:pb-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                send();
              }
            }}
            maxLength={500}
            placeholder="Diga algo para a sala…"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            className="btn btn-primary !px-3 !py-2"
            aria-label="Enviar mensagem"
          >
            <Send size={15} />
          </button>
        </div>
      )}

      {error && <p className="px-4 py-2 text-xs text-danger sm:px-5">{error}</p>}
    </div>
  );
}
