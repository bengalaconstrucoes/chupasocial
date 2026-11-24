import Link from "next/link";
import { CalendarDays, LinkIcon, Lock, MapPin } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { formatCount, formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function ProfileHeader({
  profile,
  stats,
  viewerId,
  followState,
  isOwner,
}: {
  profile: Profile;
  stats: { followers: number; following: number; posts: number };
  viewerId: string;
  followState: { following: boolean; requested: boolean };
  isOwner: boolean;
}) {
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

      <div className="px-4 pb-4 sm:px-6">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <Avatar profile={profile} size={84} className="ring-4 ring-surface" link={false} />
          <div className="mb-1 flex items-center gap-2">
            {isOwner ? (
              <Link href="/settings" className="btn btn-ghost">
                Editar perfil
              </Link>
            ) : (
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
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight">{profile.display_name}</h1>
            {profile.is_private && (
              <span className="chip !py-0.5">
                <Lock size={11} /> privado
              </span>
            )}
          </div>
          <p className="text-sm text-muted">@{profile.username}</p>

          {profile.bio && (
            <p className="prose-chupa mt-3 max-w-xl text-[0.93rem] leading-relaxed">{profile.bio}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} /> Entrou em {formatDate(profile.created_at)}
            </span>
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

          <div className="mt-3 flex gap-5 text-sm">
            <Link href={`/u/${profile.username}/following`} className="hover:underline">
              <strong className="font-semibold">{formatCount(stats.following)}</strong>{" "}
              <span className="text-muted">seguindo</span>
            </Link>
            <Link href={`/u/${profile.username}/followers`} className="hover:underline">
              <strong className="font-semibold">{formatCount(stats.followers)}</strong>{" "}
              <span className="text-muted">seguidores</span>
            </Link>
            <span>
              <strong className="font-semibold">{formatCount(stats.posts)}</strong>{" "}
              <span className="text-muted">publicações</span>
            </span>
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
