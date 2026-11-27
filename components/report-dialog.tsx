"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Flag, ImagePlus, Loader2, X } from "lucide-react";
import { reportAction } from "@/lib/actions/features";
import { createClient } from "@/lib/supabase/client";
import { cn, fileExtension } from "@/lib/utils";

const REASONS = [
  { id: "spam", label: "Spam ou golpe" },
  { id: "harassment", label: "Assédio ou bullying" },
  { id: "hate", label: "Discurso de ódio" },
  { id: "nudity", label: "Nudez ou conteúdo sexual" },
  { id: "violence", label: "Violência" },
  { id: "misinformation", label: "Informação falsa" },
  { id: "other", label: "Outro motivo" },
];

const MAX_PRINTS = 3;

type Print = { file: File; preview: string };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [prints, setPrints] = useState<Print[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Os prints ficam só na memória até enviar; libera as URLs de prévia ao fechar.
  useEffect(() => {
    return () => {
      prints.forEach((print) => URL.revokeObjectURL(print.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPrints(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: Print[] = [];
    for (const file of Array.from(files)) {
      if (prints.length + next.length >= MAX_PRINTS) break;
      if (!file.type.startsWith("image/")) {
        setError("Envie apenas imagens (print de tela).");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Cada print pode ter até 5 MB.");
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    if (next.length > 0) setPrints((current) => [...current, ...next]);
  }

  function removePrint(index: number) {
    setPrints((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((_, position) => position !== index);
    });
  }

  async function uploadPrints() {
    if (prints.length === 0) return [] as string[];
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");

    const paths: string[] = [];
    for (const print of prints) {
      const path = `${user.id}/${crypto.randomUUID()}.${fileExtension(print.file)}`;
      const { error: uploadError } = await supabase.storage
        .from("report-evidence")
        .upload(path, print.file, { contentType: print.file.type, upsert: false });
      if (uploadError) throw new Error("Não foi possível enviar o print. Tente de novo.");
      paths.push(path);
    }
    return paths;
  }

  function submit() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      let evidencePaths: string[] = [];
      try {
        evidencePaths = await uploadPrints();
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Falha no envio do print.");
        return;
      }

      const result = await reportAction({
        targetType,
        targetId,
        reason,
        details,
        evidencePaths,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(result.message ?? "Denúncia registrada.");
      setDetails("");
      setPrints((current) => {
        current.forEach((print) => URL.revokeObjectURL(print.preview));
        return [];
      });
      setTimeout(() => {
        setOpen(false);
        setStatus(null);
      }, 1600);
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
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Denunciar</h2>
                <p className="text-xs text-muted">
                  Denúncias são privadas e chegam só para a moderação.
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
              placeholder="Justifique: o que aconteceu? (opcional)"
              className="field mt-3 resize-none text-sm"
              aria-label="Justificativa da denúncia"
            />
            <p className="mt-1 text-right text-[0.68rem] text-muted">{500 - details.length}</p>

            <div className="mt-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                onChange={(event) => {
                  addPrints(event.target.files);
                  event.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {prints.map((print, index) => (
                  <span key={print.preview} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={print.preview}
                      alt={`Print ${index + 1}`}
                      className="h-16 w-16 rounded-lg border border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePrint(index)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-surface"
                      aria-label={`Remover print ${index + 1}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {prints.length < MAX_PRINTS && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-[0.6rem] text-muted hover:border-accent hover:text-accent"
                  >
                    <ImagePlus size={15} />
                    print
                  </button>
                )}
              </div>
              <p className="mt-1 text-[0.66rem] text-muted">
                Pode anexar até {MAX_PRINTS} prints (imagens de até 5 MB).
              </p>
            </div>

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
