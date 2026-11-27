import { Music2 } from "lucide-react";
import { flagBackground, findFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  size = 15,
  className,
  label = "Conta verificada",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      title={label}
      aria-label={label}
      role="img"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          fill="#1d9bf0"
          d="M12 1.6l2.5 2.1 3.2-.4 1.1 3.1 3 1.5-.6 3.2 2.1 2.4-2.1 2.4.6 3.2-3 1.5-1.1 3.1-3.2-.4L12 22.4l-2.5-2.1-3.2.4-1.1-3.1-3-1.5.6-3.2L.7 10.5l2.1-2.4-.6-3.2 3-1.5L6.3 3.3l3.2.4z"
        />
        <path
          d="M7 12.3l3.3 3.3L17 8.9"
          fill="none"
          stroke="#fff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function FlagBadge({
  flagId,
  size = 18,
  className,
}: {
  flagId: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const flag = findFlag(flagId);
  if (!flag) return null;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] align-middle text-[0.5rem] font-bold uppercase tracking-tight text-white shadow-sm ring-1 ring-black/10",
        className,
      )}
      style={{
        width: size * 1.45,
        height: size,
        background: flagBackground(flag),
        textShadow: "0 1px 1px rgb(0 0 0 / 0.55)",
      }}
      title={`Bandeira: ${flag.label}`}
      aria-label={`Bandeira: ${flag.label}`}
      role="img"
    >
      <span className="opacity-90">{flag.code}</span>
    </span>
  );
}

export function StatusLine({
  emoji,
  text,
  className,
}: {
  emoji: string | null | undefined;
  text: string | null | undefined;
  className?: string;
}) {
  if (!text && !emoji) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.72rem] text-muted",
        className,
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {text}
    </span>
  );
}

export function FavoriteSong({
  song,
  artist,
}: {
  song: string | null | undefined;
  artist?: string | null | undefined;
}) {
  if (!song) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.72rem] text-muted">
      <Music2 size={11} className="shrink-0" />
      <span className="truncate">
        {song}
        {artist ? ` · ${artist}` : ""}
      </span>
    </span>
  );
}
