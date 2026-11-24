"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/lib/actions/follow";
import { cn } from "@/lib/utils";

export function FollowButton({
  targetId,
  initialFollowing,
  initialRequested,
  isPrivate,
  size = "md",
}: {
  targetId: string;
  initialFollowing: boolean;
  initialRequested: boolean;
  isPrivate: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [state, setState] = useState({
    following: initialFollowing,
    requested: initialRequested,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleFollowAction(targetId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (state.following) setState({ following: false, requested: false });
      else if (state.requested) setState({ following: false, requested: false });
      else if (isPrivate) setState({ following: false, requested: true });
      else setState({ following: true, requested: false });
      router.refresh();
    });
  }

  const label = pending
    ? "Aguarde"
    : state.following
      ? "Seguindo"
      : state.requested
        ? "Solicitado"
        : "Seguir";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.following}
        className={cn(
          "btn",
          state.following || state.requested ? "btn-ghost" : "btn-primary",
          size === "sm" && "!px-3 !py-1.5 text-xs",
        )}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state.following ? (
          <Check size={14} />
        ) : (
          <UserPlus size={14} />
        )}
        {label}
      </button>
      {error && <span className="text-[0.68rem] text-danger">{error}</span>}
    </div>
  );
}
