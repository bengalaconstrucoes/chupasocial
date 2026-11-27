import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Crown, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/badges";
import { fetchWeeklyRanking } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCount } from "@/lib/utils";

export const metadata: Metadata = { title: "Ranking da semana" };

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ranking");

  const ranking = await fetchWeeklyRanking(20);
  const podium = ranking.slice(0, 3);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Trophy size={16} className="text-accent" /> Ranking da semana
        </h1>
        <p className="text-xs text-muted">
          Publicações, curtidas recebidas e novos seguidores nos últimos 7 dias.
        </p>
      </div>

      {ranking.length === 0 ? (
        <p className="px-5 py-14 text-center text-sm text-muted">
          A semana está só começando. Publique algo para entrar no ranking.
        </p>
      ) : (
        <div className="px-4 py-5 sm:px-5">
          <ol className="grid gap-3 sm:grid-cols-3">
            {podium.map((row) => (
              <li
                key={row.profile.id}
                className={cn(
                  "chupa-card flex flex-col items-center gap-2 p-4 text-center",
                  row.rank === 1 && "border-accent",
                )}
              >
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-muted">
                  {row.rank === 1 ? <Crown size={13} className="text-accent" /> : null}#{row.rank}
                </span>
                <Avatar profile={{ ...row.profile, avatar_url: row.profile.avatar_url }} size={56} />
                <div className="min-w-0">
                  <Link
                    href={`/u/${row.profile.username}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  >
                    {row.profile.display_name}
                    {row.profile.is_verified && <VerifiedBadge size={13} />}
                  </Link>
                  <p className="truncate text-xs text-muted">@{row.profile.username}</p>
                </div>
                <p className="text-lg font-bold text-accent">{formatCount(row.points)} pts</p>
                <p className="text-[0.68rem] text-muted">
                  {row.posts} posts · {row.likes} curtidas
                </p>
              </li>
            ))}
          </ol>

          {ranking.length > 3 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
              {ranking.slice(3).map((row) => (
                <li key={row.profile.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-sm tabular-nums text-muted">{row.rank}</span>
                  <Avatar profile={row.profile} size={34} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${row.profile.username}`}
                      className="inline-flex items-center gap-1 truncate text-sm font-medium hover:underline"
                    >
                      {row.profile.display_name}
                      {row.profile.is_verified && <VerifiedBadge size={12} />}
                    </Link>
                    <p className="truncate text-xs text-muted">@{row.profile.username}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCount(row.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
