import { computeBadges } from "@/lib/badges";
import type { AchievementCounts } from "@/lib/queries";

/** Emblemas conquistados, menos os que a pessoa escolheu esconder. */
export function ProfileBadges({
  counts,
  hidden = [],
}: {
  counts: AchievementCounts;
  hidden?: string[] | null;
}) {
  const hiddenSet = new Set(hidden ?? []);
  const badges = computeBadges(counts).filter((badge) => !hiddenSet.has(badge.id));
  if (badges.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Conquistas do perfil">
      {badges.map((badge) => (
        <li key={badge.id}>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.7rem] text-muted"
            title={badge.hint}
          >
            <span aria-hidden>{badge.emoji}</span>
            {badge.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
