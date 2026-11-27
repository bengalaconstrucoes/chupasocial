"use client";

import { useTransition } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { startConversationAction } from "@/lib/actions/messages";
import { cn } from "@/lib/utils";

export function StartChatButton({
  userId,
  name,
  compact = false,
}: {
  userId: string;
  name: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => void startConversationAction(userId))}
      disabled={pending}
      className={cn(
        compact
          ? "mt-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.66rem] font-medium text-accent hover:bg-accent hover:text-accent-ink"
          : "btn btn-ghost !px-3 !py-1.5 text-xs",
        "disabled:opacity-50",
      )}
      aria-label={`Conversar com ${name}`}
    >
      {pending ? <Loader2 size={compact ? 10 : 13} className="animate-spin" /> : <MessageCircle size={compact ? 10 : 13} />}
      conversar
    </button>
  );
}
