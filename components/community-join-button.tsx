"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Plus } from "lucide-react";
import { toggleCommunityMembershipAction } from "@/lib/actions/communities";
import { cn } from "@/lib/utils";

export function CommunityJoinButton({
  communityId,
  isMember,
  isOwner = false,
  requiresApproval = false,
  pendingRequest = false,
}: {
  communityId: string;
  isMember: boolean;
  isOwner?: boolean;
  requiresApproval?: boolean;
  pendingRequest?: boolean;
}) {
  const router = useRouter();
  const [member, setMember] = useState(isMember);
  const [requested, setRequested] = useState(pendingRequest);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (isOwner) return null;

  function toggle() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await toggleCommunityMembershipAction(communityId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (member) {
        setMember(false);
        setRequested(false);
        setNotice(result.message ?? "Você saiu da comunidade.");
      } else if (requiresApproval && !requested) {
        setRequested(true);
        setNotice(result.message ?? "Pedido enviado.");
      } else {
        setRequested(false);
        setMember(true);
        setNotice(result.message ?? "Você entrou na comunidade.");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cn("btn", member ? "btn-ghost" : requested ? "btn-ghost" : "btn-primary")}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : requested ? (
          <Clock size={14} />
        ) : member ? (
          <Check size={14} />
        ) : (
          <Plus size={14} />
        )}
        {requested ? "cancelar pedido" : member ? "Sair" : requiresApproval ? "Pedir para entrar" : "Entrar"}
      </button>
      {notice && <span className="text-[0.68rem] text-muted">{notice}</span>}
      {error && <span className="text-[0.68rem] text-danger">{error}</span>}
    </div>
  );
}
