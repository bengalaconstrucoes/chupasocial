"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquareHeart } from "lucide-react";
import { sendFeedbackAction } from "@/lib/actions/feedback";
import { cn } from "@/lib/utils";

const MOODS = [
  { id: "idea", label: "Ideia" },
  { id: "bug", label: "Problema" },
  { id: "love", label: "Elogio" },
  { id: "other", label: "Outro" },
] as const;

export function FeedbackBox() {
  const [mood, setMood] = useState<string>("idea");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await sendFeedbackAction(mood, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setMessage(result.message ?? "Recado enviado.");
    });
  }

  return (
    <div>
      <p className="text-xs text-muted">
        Conta o que está funcionando, o que quebrou ou o que você quer ver por aqui.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {MOODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMood(item.id)}
            aria-pressed={mood === item.id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              mood === item.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:bg-surface-2",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Escreva seu recado…"
        className="mt-2 w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[0.68rem] text-muted">{body.length}/500</span>
        <button
          type="button"
          onClick={send}
          disabled={pending || body.trim().length < 3}
          className="btn btn-primary text-xs"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <MessageSquareHeart size={13} />}
          enviar recado
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {message && <p className="mt-2 text-xs text-ok">{message}</p>}
    </div>
  );
}
