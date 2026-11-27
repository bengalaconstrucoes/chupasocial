import Link from "next/link";
import { CalendarDays, Eye, LinkIcon, Lock, MapPin } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FavoriteSong, FlagBadge, StatusLine, VerifiedBadge } from "@/components/badges";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { ProfileMenu } from "@/components/profile-menu";
import { ProfileBadges } from "@/components/profile-badges";
import { nameFontClass } from "@/lib/profile-style";
import { presenceInfo } from "@/lib/presence";
import { cn, formatCount, formatDate } from "@/lib/utils";
import type { AchievementCounts } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function ProfileHeader({
  profile,
  stats,
  viewerId,
  followState,
  isOwner,
  relationship = "none",
  visits = 0,
  achievements,
}: {
  profile: Profile;
  stats: { followers: number; following: number; posts: number };
  viewerId: string;
  followState: { following: boolean; requested: boolean };
  isOwner: boolean;
  relationship?: "none" | "blocking" | "blocked";
  visits?: number;
  achievements?: AchievementCounts;
}) {
  const y2k = profile.profile_style === "y2k";
  const presence = presenceInfo(profile.last_seen_at);
  return (
    <section className="border-b border-line bg-surface">
      <div className="relative h-36 overflow-hidden bg-surface-2 sm:h-44">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner_url}
            alt={`Banner de ${profile.display_name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(circle at 18% 120%, var(--accent-soft) 0%, transparent 60%), radial-gradient(circle at 78% -10%, var(--accent-soft) 0%, transparent 55%)",
            }}
            aria-hidden
          />
        )}
      </div>

      <div className={cn("px-4 pb-4 sm:px-6", y2k && "chupa-y2k")}>
        <div className="-mt-10 flex items-end justify-between gap-3">
          <Avatar profile={profile} size={84} className="ring-4 ring-surface" link={false} />
          <div className="mb-1 flex items-center gap-2">
            {isOwner ? (
              <Link href="/settings" className="btn btn-ghost">
                Editar perfil
              </Link>
            ) : (
              <>
                {relationship === "none" && (
                  <>
                    <MessageButton targetId={profile.id} />
                    <FollowButton
                      targetId={profile.id}
                      initialFollowing={followState.following}
                      initialRequested={followState.requested}
                      isPrivate={profile.is_private}
                    />
                  </>
                )}
                <ProfileMenu
                  targetId={profile.id}
                  username={profile.username}
                  relationship={relationship}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={cn(
                "text-xl font-semibold leading-tight",
                nameFontClass(profile.name_font),
                y2k && "chupa-y2k-name",
              )}
            >
              {profile.display_name}
            </h1>
            {profile.is_verified && <VerifiedBadge size={18} />}
            <FlagBadge flagId={profile.flag} size={16} />
            {profile.is_private && (
              <span className="chip !py-0.5">
                <Lock size={11} /> privado
              </span>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            @{profile.username}
            {presence && (
              <span className="inline-flex items-center gap-1 text-[0.7rem]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    presence.tone === "online"
                      ? "bg-emerald-500"
                      : presence.tone === "away"
                        ? "bg-amber-500"
                        : "bg-muted",
                  )}
                  aria-hidden
                />
                {presence.label}
              </span>
            )}
          </p>

          {(profile.status_text || profile.status_emoji) && (
            <div className="mt-2">
              <StatusLine emoji={profile.status_emoji} text={profile.status_text} />
            </div>
          )}

          {profile.bio && (
            <p className="prose-chupa mt-3 max-w-xl text-[0.93rem] leading-relaxed">{profile.bio}</p>
          )}

          {achievements && <ProfileBadges counts={achievements} />}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} /> Entrou em {formatDate(profile.created_at)}
            </span>
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <LinkIcon size={12} />
                {profile.website.replace(/^https?:\/\//, "").slice(0, 34)}
              </a>
            )}
          </div>

          {(profile.favorite_song || profile.favorite_song_artist) && (
            <div className="mt-2">
              <FavoriteSong song={profile.favorite_song} artist={profile.favorite_song_artist} />
            </div>
          )}

          <div className="mt-3 flex gap-5 text-sm">
            <Link href={`/u/${profile.username}/following`} className="hover:underline">
              <strong className="font-semibold">{formatCount(stats.following)}</strong>{" "}
              <span className="text-muted">seguindo</span>
            </Link>
            <Link href={`/u/${profile.username}/followers`} className="hover:underline">
              <strong className="font-semibold">{formatCount(stats.followers)}</strong>{" "}
              <span className="text-muted">seguidores</span>
            </Link>
            {profile.show_stats ? (
              <span>
                <strong className="font-semibold">{formatCount(stats.posts)}</strong>{" "}
                <span className="text-muted">publicações</span>
              </span>
            ) : (
              isOwner && (
                <span className="text-[0.72rem] text-muted">estatísticas ocultas</span>
              )
            )}
            {(profile.show_visits || isOwner) && visits > 0 && (
              <span className="inline-flex items-center gap-1 text-muted" title="Visitas ao perfil">
                <Eye size={12} /> {formatCount(visits)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProfileLocked({ profile }: { profile: Profile }) {
  return (
    <div className="border-b border-line bg-surface px-6 py-14 text-center">
      <Lock size={26} className="mx-auto text-muted" />
      <h2 className="mt-3 text-lg font-semibold">Esta conta é privada</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Siga @{profile.username} e aguarde a aprovação para ver as publicações, seguidores e
        seguindo.
      </p>
      <div className="mt-5 flex justify-center">
        <FollowButton
          targetId={profile.id}
          initialFollowing={false}
          initialRequested={false}
          isPrivate
        />
      </div>
    </div>
  );
}

export function ProfilePlaceholderIcon() {
  return <MapPin size={14} />;
}
