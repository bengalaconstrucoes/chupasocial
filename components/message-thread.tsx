"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  Clock3,
  EyeOff,
  ImagePlus,
  Info,
  Loader2,
  Mic,
  SendHorizonal,
  Square,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CallButtons } from "@/components/call/call-buttons";
import { GifPicker } from "@/components/gif-picker";
import { GroupInfo } from "@/components/group-info";
import { ReportDialog } from "@/components/report-dialog";
import { ViewOnceMessage } from "@/components/view-once-message";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { markConversationReadAction, sendMessageAction } from "@/lib/actions/messages";
import { cn, fileExtension, formatTime } from "@/lib/utils";
import type { GifItem, Message, MessageAttachment, Profile } from "@/lib/types";

const MAX_UPLOAD = 10 * 1024 * 1024;

export function MessageThread({
  conversationId,
  title,
  createdBy,
  isGroup,
  viewer,
  members,
  initialMessages,
}: {
  conversationId: string;
  title: string | null;
  createdBy: string | null;
  isGroup: boolean;
  viewer: Profile;
  members: Profile[];
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [viewOnce, setViewOnce] = useState(false);
  const [expiry, setExpiry] = useState("0");
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingSentRef = useRef(0);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const other = members.find((member) => member.id !== viewer.id) ?? null;
  const heading = isGroup ? title || "Grupo sem nome" : other?.display_name ?? "Conversa";

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

  // Presença (online) e aviso de "digitando…".
  useEffect(() => {
    const supabase = createClient();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const channel = supabase.channel(`chupa-presence-${conversationId}`, {
      config: { broadcast: { self: false }, presence: { key: viewer.id } },
    });
    presenceChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (!payload?.from || payload.from === viewer.id) return;
        const name = payload.name ?? "Alguém";
        setTypingNames((current) => (current.includes(name) ? current : [...current, name]));
        const existing = timers.get(payload.from);
        if (existing) clearTimeout(existing);
        timers.set(
          payload.from,
          setTimeout(() => {
            setTypingNames((current) => current.filter((item) => item !== name));
            timers.delete(payload.from);
          }, 3500),
        );
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const names = Object.entries(state)
          .filter(([id]) => id !== viewer.id)
          .map(([, metas]) => metas[0]?.name as string | undefined)
          .filter((name): name is string => Boolean(name));
        setOnlineNames(names);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ name: viewer.display_name, online_at: Date.now() });
        }
      });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      void supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [conversationId, viewer.display_name, viewer.id]);

  function notifyTyping() {
    const now = Date.now();
    if (now - typingSentRef.current < 1400) return;
    typingSentRef.current = now;
    void presenceChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { from: viewer.id, name: viewer.display_name },
    });
  }

  async function uploadAudio(blob: Blob) {
    if (blob.size > MAX_UPLOAD) {
      setError("O áudio ficou grande demais.");
      return;
    }
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${viewer.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("message-media")
      .upload(path, blob, {
        contentType: blob.type || "audio/webm",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      setError("Falha ao enviar o áudio.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("message-media").getPublicUrl(path);
    await deliver("", { type: "audio", url: data.publicUrl, previewUrl: data.publicUrl });
    setUploading(false);
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Seu navegador não permite gravar áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecording(false);
        setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) await uploadAudio(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((value) => {
          if (value >= 119) {
            recorderRef.current?.stop();
            return 0;
          }
          return value + 1;
        });
      }, 1000);
    } catch {
      setError("Não foi possível acessar o microfone.");
    }
  }

  async function deliver(text: string, attachment: MessageAttachment | null) {
    setSending(true);
    setError(null);

    const result = await sendMessageAction(conversationId, text, attachment, {
      viewOnce,
      expiresInMinutes: expiry === "0" ? null : Number(expiry),
    });
    if (!result.ok) {
      setError(result.error);
      setSending(false);
      return false;
    }

    setBody("");
    setViewOnce(false);
    setExpiry("0");
    setSending(false);
    router.refresh();
    return true;
  }

  async function sendText() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    await deliver(trimmed, null);
    textareaRef.current?.focus();
  }

  async function sendGif(gif: GifItem) {
    setGifOpen(false);
    await deliver(body.trim(), {
      type: "gif",
      url: gif.url,
      previewUrl: gif.preview,
    });
  }

  async function sendImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens e GIFs são aceitos.");
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setError("A imagem pode ter até 10 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${viewer.id}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("message-media")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      setError("Falha ao enviar a imagem.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("message-media").getPublicUrl(path);
    await deliver(body.trim(), {
      type: "image",
      url: data.publicUrl,
      previewUrl: data.publicUrl,
    });
    setUploading(false);
    textareaRef.current?.focus();
  }

  const busy = sending || uploading;

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col bg-surface">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-3 py-2.5 backdrop-blur sm:px-4">
        <Link
          href="/messages"
          className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Voltar para mensagens"
        >
          <ArrowLeft size={18} />
        </Link>

        {isGroup ? (
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Users size={17} />
          </span>
        ) : (
          <Avatar profile={other} size={34} />
        )}

        <div className="min-w-0 flex-1">
          <Link
            href={!isGroup && other ? `/u/${other.username}` : "#"}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {heading}
          </Link>
          <p className="truncate text-xs text-muted">
            {typingNames.length > 0 ? (
              <span className="text-accent">
                {typingNames.slice(0, 2).join(", ")} digitando…
              </span>
            ) : onlineNames.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                {isGroup ? `${onlineNames.length} online` : "online agora"}
              </span>
            ) : isGroup ? (
              `${members.length} participantes`
            ) : other ? (
              `@${other.username}`
            ) : (
              "Conversa"
            )}
          </p>
        </div>

        <CallButtons conversationId={conversationId} members={members} />

        {isGroup && (
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Informações do grupo"
            title="Informações do grupo"
          >
            <Info size={17} />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-4">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">
              {isGroup ? "O grupo está vazio" : "Comece a conversa"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Envie texto, imagens ou GIFs. Tudo chega em tempo real e fica salvo no histórico.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          if (message.expires_at && new Date(message.expires_at).getTime() < Date.now()) {
            return null;
          }
          const mine = message.sender_id === viewer.id;
          const previous = messages[index - 1];
          const grouped = previous?.sender_id === message.sender_id;
          const sender =
            members.find((member) => member.id === message.sender_id) ?? (mine ? viewer : null);

          return (
            <div key={message.id}>
              {isGroup && !mine && !grouped && (
                <p className="mb-0.5 ml-9 text-[0.7rem] font-medium text-muted">
                  {sender?.display_name ?? "Participante"}
                </p>
              )}
              <div
                className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
              >
                {!mine && (
                  <span className={cn("w-7 shrink-0", grouped && "invisible")}>
                    <Avatar profile={sender} size={28} link={false} />
                  </span>
                )}
                <div
                  className={cn(
                    "animate-pop max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    mine
                      ? "rounded-br-md bg-accent text-accent-ink"
                      : "rounded-bl-md bg-surface-2 text-ink",
                  )}
                >
                  {message.view_once && !mine ? (
                    <ViewOnceMessage messageId={message.id} />
                  ) : (
                    <>
                      {message.attachment_url && message.attachment_type === "audio" && (
                        <audio controls src={message.attachment_url} className="mb-1 w-56 max-w-full" />
                      )}
                      {message.attachment_url && message.attachment_type !== "audio" && (
                        <a
                          href={message.attachment_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mb-1.5 block overflow-hidden rounded-lg"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.attachment_preview_url ?? message.attachment_url}
                            alt={message.attachment_type === "gif" ? "GIF enviado" : "Imagem enviada"}
                            loading="lazy"
                            className="max-h-64 w-full max-w-xs object-cover"
                          />
                        </a>
                      )}
                      {message.body && <p className="prose-chupa">{message.body}</p>}
                    </>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    {message.expires_at && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[0.6rem]",
                          mine ? "text-accent-ink/70" : "text-muted",
                        )}
                        title="Mensagem temporária"
                      >
                        <Clock3 size={9} /> temporária
                      </span>
                    )}
                    {!mine && (
                      <ReportDialog
                        targetType="message"
                        targetId={message.id}
                        label="Denunciar mensagem"
                        compact
                        className="!p-0.5 opacity-50 hover:opacity-100"
                      />
                    )}
                    <p
                      className={cn(
                        "text-[0.62rem]",
                        mine ? "text-accent-ink/70" : "text-muted",
                      )}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
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
          void sendText();
        }}
      >
        <div className="relative flex items-end gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void sendImage(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={busy && !recording}
            className={cn(
              "rounded-full p-2 transition-colors disabled:opacity-40",
              recording
                ? "bg-danger text-white"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
            aria-label={recording ? "Parar gravação" : "Gravar mensagem de voz"}
            title={recording ? "Parar e enviar áudio" : "Mensagem de voz"}
          >
            {recording ? <Square size={17} /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            aria-label="Enviar imagem"
            title="Enviar imagem"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setGifOpen((value) => !value)}
            disabled={busy}
            className={cn(
              "rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40",
              gifOpen && "bg-surface-2 text-ink",
            )}
            aria-label="Enviar GIF"
            aria-expanded={gifOpen}
            title="Enviar GIF"
          >
            <Clapperboard size={18} />
          </button>

          {gifOpen && <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} />}

          <button
            type="button"
            onClick={() => setViewOnce((value) => !value)}
            aria-pressed={viewOnce}
            className={cn(
              "rounded-full p-2 transition-colors",
              viewOnce ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
            aria-label="Enviar como visualização única"
            title="Visualização única"
          >
            <EyeOff size={17} />
          </button>

          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="max-w-[74px] rounded-lg border border-line bg-surface px-1 py-1.5 text-[0.65rem] text-muted"
            aria-label="Tempo de expiração da mensagem"
            title="Mensagem temporária"
          >
            <option value="0">∞</option>
            <option value="60">1 h</option>
            <option value="1440">24 h</option>
            <option value="10080">7 d</option>
          </select>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              notifyTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendText();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={isGroup ? "Mensagem para o grupo" : "Escreva uma mensagem"}
            className="field max-h-32 flex-1 resize-none text-sm"
            aria-label="Mensagem"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="btn btn-primary !h-10 !w-10 !p-0"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 pl-1 text-[0.65rem] text-muted">
          {recording ? (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              gravando {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")} — toque no quadrado para enviar
            </span>
          ) : (
            <>
              <span>Enter envia</span>
              <span>· Shift+Enter quebra linha</span>
              <span>· mídia até 10 MB</span>
              {viewOnce && <span className="text-accent">· visualização única</span>}
              {expiry !== "0" && <span className="text-accent">· expira</span>}
            </>
          )}
        </p>
      </form>

      {infoOpen && (
        <GroupInfo
          conversationId={conversationId}
          title={title || "Grupo sem nome"}
          createdBy={createdBy}
          viewerId={viewer.id}
          members={members}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}
