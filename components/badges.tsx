import { Music2 } from "lucide-react";
import { findFlag, flagImage } from "@/lib/flags";
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

/** Emblema da equipe: escudo com estrela. */
export function AdminBadge({
  size = 15,
  className,
  label = "Equipe ChupaSocial",
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
          fill="#7c3aed"
          d="M12 1.8l8 3v6.1c0 5-3.3 9.2-8 11.3-4.7-2.1-8-6.3-8-11.3V4.8z"
        />
        <path
          d="M12 6.4l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"
          fill="#fff"
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

  const width = Math.max(24, Math.round(size * 1.5));
  const label = flag.era ? `${flag.label} (${flag.era})` : flag.label;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-surface-2 align-middle shadow-[0_1px_3px_rgb(0_0_0_/_0.22)] ring-1 ring-black/15",
        className,
      )}
      style={{ width, height: size }}
      title={`Bandeira: ${label}`}
      aria-label={`Bandeira: ${label}`}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flagImage(flag.file, 120)}
        alt=""
        width={width}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
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
