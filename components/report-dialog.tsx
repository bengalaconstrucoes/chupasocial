"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { reportAction } from "@/lib/actions/features";
import { cn } from "@/lib/utils";

const REASONS = [
  { id: "spam", label: "Spam ou golpe" },
  { id: "harassment", label: "Assédio ou bullying" },
  { id: "hate", label: "Discurso de ódio" },
  { id: "nudity", label: "Nudez ou conteúdo sexual" },
  { id: "violence", label: "Violência" },
  { id: "misinformation", label: "Informação falsa" },
  { id: "other", label: "Outro motivo" },
];

export function ReportDialog({
  targetType,
  targetId,
  label,
  className,
  compact = false,
}: {
  targetType: "post" | "message" | "profile";
  targetId: string;
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await reportAction({ targetType, targetId, reason, details });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(result.message ?? "Denúncia registrada.");
      setDetails("");
      setTimeout(() => setOpen(false), 1400);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-danger",
          compact ? "p-1.5" : "px-2 py-1.5 text-xs",
          className,
        )}
        aria-label={label}
        title={label}
      >
        <Flag size={compact ? 13 : 15} />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Denunciar conteúdo"
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Denunciar</h2>
                <p className="text-xs text-muted">
                  Conte o que está errado. Denúncias são privadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-1.5">
              {REASONS.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    reason === item.id
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                    className="accent-[var(--accent)]"
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Detalhes (opcional)"
              className="field mt-3 resize-none text-sm"
              aria-label="Detalhes da denúncia"
            />

            {(error || status) && (
              <p
                role={error ? "alert" : "status"}
                className={cn("mt-2 text-xs", error ? "text-danger" : "text-ok")}
              >
                {error ?? status}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost !px-3 !py-1.5 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="btn btn-danger !px-3 !py-1.5 text-xs"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />}
                Enviar denúncia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
