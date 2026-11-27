export type Presence = {
  label: string;
  tone: "online" | "away" | "offline";
};

/** Converte o último sinal de vida em texto de presença. */
export function presenceInfo(lastSeenAt: string | null | undefined): Presence | null {
  if (!lastSeenAt) return null;

  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(diff) || diff < 0) return null;

  const minutes = Math.floor(diff / 60_000);

  if (minutes < 3) return { label: "online agora", tone: "online" };
  if (minutes < 20) return { label: "ausente", tone: "away" };
  if (minutes < 60) return { label: `visto há ${minutes} min`, tone: "offline" };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `visto há ${hours} h`, tone: "offline" };

  const days = Math.floor(hours / 24);
  return { label: `visto há ${days} d`, tone: "offline" };
}
