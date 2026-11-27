"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { joinCommunityByTokenAction } from "@/lib/actions/communities";

export function JoinInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await joinCommunityByTokenAction(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Pronto.");
      router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={join} disabled={pending} className="btn btn-primary">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        entrar na comunidade
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {message && <p className="mt-2 text-xs text-ok">{message}</p>}
    </div>
  );
}
