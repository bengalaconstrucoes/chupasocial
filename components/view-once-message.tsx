"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2, Timer } from "lucide-react";
import { openViewOnceAction, type OpenedMessage } from "@/lib/actions/messages";

export function ViewOnceMessage({ messageId }: { messageId: string }) {
  const [opened, setOpened] = useState<OpenedMessage | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await openViewOnceAction(messageId);
      if (!result.ok) {
        setError(result.error);
        setGone(true);
        return;
      }
      setOpened(result.message);
      // Depois de exibir, some da tela: o servidor já apagou.
      setTimeout(() => setGone(true), 12000);
    });
  }

  if (gone) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-2.5 py-1.5 text-xs opacity-70">
        <Timer size={12} /> mensagem de visualização única aberta
      </p>
    );
  }

  if (opened) {
    return (
      <div className="max-w-xs space-y-1.5">
        {opened.attachmentUrl && opened.attachmentType === "audio" && (
          <audio controls src={opened.attachmentUrl} className="w-full" />
        )}
        {opened.attachmentUrl && opened.attachmentType !== "audio" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opened.attachmentUrl}
            alt="Mídia de visualização única"
            className="max-h-60 w-full rounded-lg object-cover"
          />
        )}
        {opened.body && <p className="whitespace-pre-wrap">{opened.body}</p>}
        <p className="text-[0.62rem] opacity-70">some ao fechar a conversa</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/25"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Eye size={13} />}
        Ver uma vez
      </button>
      {error && <p className="mt-1 text-[0.65rem] opacity-80">{error}</p>}
    </div>
  );
}
