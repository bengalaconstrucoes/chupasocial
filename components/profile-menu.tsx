"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, Loader2, MoreHorizontal, ShieldOff } from "lucide-react";
import { setBlockAction } from "@/lib/actions/blocks";
import { ReportDialog } from "@/components/report-dialog";

export function ProfileMenu({
  targetId,
  username,
  relationship,
}: {
  targetId: string;
  username: string;
  relationship: "none" | "blocking" | "blocked";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 2200);
  }

  function toggleBlock() {
    const next = relationship !== "blocking";
    if (next && !window.confirm(`Bloquear @${username}? A pessoa deixa de ver seu perfil e não pode te seguir nem mandar mensagem.`)) {
      return;
    }

    startTransition(async () => {
      const result = await setBlockAction(targetId, next);
      setOpen(false);
      if (!result.ok) {
        flash(result.error);
        return;
      }
      router.refresh();
      flash(result.message ?? "Feito.");
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`);
      setOpen(false);
      flash("Link do perfil copiado.");
    } catch {
      flash("Não foi possível copiar.");
    }
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Mais opções do perfil"
        aria-expanded={open}
        className="btn btn-ghost !h-9 !w-9 !rounded-full !p-0"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={17} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-lg">
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
          >
            <Copy size={14} /> Copiar link do perfil
          </button>
          <div className="border-t border-line px-1 py-1">
            <ReportDialog
              targetType="profile"
              targetId={targetId}
              label="Denunciar perfil"
              className="w-full"
            />
          </div>
          {relationship !== "blocked" && (
            <button
              type="button"
              onClick={toggleBlock}
              disabled={pending}
              className={
                relationship === "blocking"
                  ? "flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left hover:bg-surface-2"
                  : "flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-danger hover:bg-surface-2"
              }
            >
              {relationship === "blocking" ? <ShieldOff size={14} /> : <Ban size={14} />}
              {relationship === "blocking" ? "Desbloquear perfil" : "Bloquear perfil"}
            </button>
          )}
        </div>
      )}

      {notice && (
        <span role="status" className="absolute right-0 top-full mt-1 whitespace-nowrap text-[0.68rem] text-muted">
          {notice}
        </span>
      )}
    </div>
  );
}

export function BlockedBadge({ label }: { label: string }) {
  return (
    <span className="chip !py-1 text-danger">
      <Check size={11} /> {label}
    </span>
  );
}
