"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";
import { createLiveRoomAction } from "@/lib/actions/live-rooms";

export function LiveRoomCreate({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createLiveRoomAction(communityId, title);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setOpen(false);
      setMessage(result.message ?? "Sala aberta.");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary text-xs">
          <Radio size={13} /> abrir sala ao vivo
        </button>
        {message && <p className="mt-1 text-xs text-ok">{message}</p>}
      </div>
    );
  }

  return (
    <div className="chupa-card p-3">
      <label className="field-label" htmlFor="live-room-title">
        Título da sala
      </label>
      <input
        id="live-room-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
        placeholder="Ex.: escutando o álbum novo junto"
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          disabled={pending || title.trim().length < 3}
          className="btn btn-primary text-xs"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
          abrir
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-xs">
          cancelar
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
