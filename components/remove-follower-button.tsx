"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus } from "lucide-react";
import { removeFollowerAction } from "@/lib/actions/follow";

export function RemoveFollowerButton({
  followerId,
  displayName,
}: {
  followerId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeFollowerAction(followerId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (error) {
    return <span className="text-[0.68rem] text-danger">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-quiet !px-2 !py-1 text-[0.7rem] text-muted hover:text-danger"
        title={`Remover ${displayName} dos seguidores`}
      >
        <UserMinus size={13} /> Remover
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="btn btn-danger !px-2 !py-1 text-[0.7rem]"
      >
        {pending && <Loader2 size={11} className="animate-spin" />}
        Confirmar
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="btn btn-quiet !px-2 !py-1 text-[0.7rem]"
      >
        Cancelar
      </button>
    </div>
  );
}
