import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="ChupaSocial"
      className={cn("h-8 w-8", className)}
    >
      <circle cx="20" cy="16" r="13" fill="var(--accent)" />
      <path
        d="M20 16c0-4.4 3.6-8 8-8M20 16c0 4.4-3.6 8-8 8M20 16c4.4 0 8 3.6 8 8M20 16c-4.4 0-8-3.6-8-8"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <rect x="18.4" y="27" width="3.2" height="11" rx="1.6" fill="var(--ink)" opacity="0.85" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">
        Chupa<span className="text-accent">Social</span>
      </span>
    </span>
  );
}
