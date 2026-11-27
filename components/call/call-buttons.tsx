"use client";

import { Phone, Video } from "lucide-react";
import { useCall, type CallParticipant } from "@/components/call/call-provider";

export function CallButtons({
  conversationId,
  members,
}: {
  conversationId: string;
  members: CallParticipant[];
}) {
  const { startCall, inCall } = useCall();

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => void startCall(conversationId, members, "audio")}
        disabled={inCall}
        className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Chamada de áudio"
        title="Chamada de áudio"
      >
        <Phone size={17} />
      </button>
      <button
        type="button"
        onClick={() => void startCall(conversationId, members, "video")}
        disabled={inCall}
        className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label="Chamada de vídeo"
        title="Chamada de vídeo"
      >
        <Video size={17} />
      </button>
    </div>
  );
}
