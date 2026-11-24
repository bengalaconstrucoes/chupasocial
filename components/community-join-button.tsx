"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toggleCommunityMembershipAction } from "@/lib/actions/communities";
import { cn } from "@/lib/utils";

export function CommunityJoinButton({
  communityId,
  isMember,
  isOwner = false,
}: {
  communityId: string;
  isMember: boolean;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [member, setMember] = useState(isMember);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isOwner) return null;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleCommunityMembershipAction(communityId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMember(!member);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cn("btn", member ? "btn-ghost" : "btn-primary")}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : member ? (
          <Check size={14} />
        ) : (
          <Plus size={14} />
        )}
        {member ? "Sair" : "Entrar"}
      </button>
      {error && <span className="text-[0.68rem] text-danger">{error}</span>}
    </div>
  );
}
