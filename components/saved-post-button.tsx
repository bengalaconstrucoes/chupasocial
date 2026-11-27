"use client";

import { useState, useTransition } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { toggleSaveAction } from "@/lib/actions/features";
import { cn } from "@/lib/utils";

export function SavedPostButton({
  postId,
  initialSaved,
  onChange,
}: {
  postId: string;
  initialSaved: boolean;
  onChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function toggle() {
    const next = !saved;
    setSaved(next);
    onChange?.(next);
    startTransition(async () => {
      const result = await toggleSaveAction(postId, next);
      if (!result.ok) {
        setSaved(!next);
        onChange?.(!next);
        setNotice(result.error);
        setTimeout(() => setNotice(null), 2400);
        return;
      }
      setNotice(next ? "Salvo" : "Removido dos salvos");
      setTimeout(() => setNotice(null), 1800);
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remover dos salvos" : "Salvar publicação"}
        title={saved ? "Remover dos salvos" : "Salvar publicação"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-surface-2",
          saved ? "text-accent" : "text-muted hover:text-ink",
        )}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Bookmark size={16} className={saved ? "fill-current" : ""} />
        )}
      </button>
      {notice && (
        <span role="status" className="truncate text-[0.68rem] text-muted">
          {notice}
        </span>
      )}
    </span>
  );
}
