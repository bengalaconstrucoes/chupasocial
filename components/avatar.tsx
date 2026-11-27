import Link from "next/link";
import { avatarFrameClass } from "@/lib/avatar-frames";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type AvatarProps = {
  profile:
    | (Pick<Profile, "username" | "display_name" | "avatar_url"> & {
        avatar_frame?: string | null;
      })
    | null;
  size?: number;
  className?: string;
  link?: boolean;
};

export function Avatar({ profile, size = 40, className, link = true }: AvatarProps) {
  const initials = (profile?.display_name || profile?.username || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const frameClass = avatarFrameClass(profile?.avatar_frame);

  const image = (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        frameClass && "pfp-frame",
        frameClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="pfp-frame-inner relative flex items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold text-muted ring-1 ring-line"
        style={{ fontSize: Math.max(11, size * 0.36) }}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={`Foto de ${profile.display_name || profile.username}`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
      </span>
    </span>
  );

  if (!link || !profile) return image;

  return (
    <Link
      href={`/u/${profile.username}`}
      className="shrink-0 rounded-full transition-opacity hover:opacity-85"
      aria-label={`Perfil de ${profile.username}`}
    >
      {image}
    </Link>
  );
}
