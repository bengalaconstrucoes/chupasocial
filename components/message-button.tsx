"use client";

import { useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { startConversationAction } from "@/lib/actions/messages";

export function MessageButton({ targetId }: { targetId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => void (await startConversationAction(targetId)))}
      disabled={pending}
      className="btn btn-ghost"
      title="Enviar mensagem"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
      Mensagem
    </button>
  );
}
