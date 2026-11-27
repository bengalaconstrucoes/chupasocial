import Link from "next/link";
import {
  CalendarDays,
  Eye,
  Heart,
  LinkIcon,
  Lock,
  MapPin,
  Music2,
  Star,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  AdminBadge,
  FavoriteSong,
  FlagBadge,
  StatusLine,
  VerifiedBadge,
} from "@/components/badges";
import { ProfileMusic } from "@/components/profile-music";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { ProfileMenu } from "@/components/profile-menu";
import { ProfileBadges } from "@/components/profile-badges";
import { nameFontClass } from "@/lib/profile-style";
import { presenceInfo } from "@/lib/presence";
import { cn, formatCount, formatDate } from "@/lib/utils";
import type { AchievementCounts, TopFriend } from "@/lib/queries";
import type { Profile } from "@/lib/types";

type HeaderProps = {
  profile: Profile;
  stats: { followers: number; following: number; posts: number };
  viewerId: string;
  followState: { following: boolean; requested: boolean };
  isOwner: boolean;
  relationship?: "none" | "blocking" | "blocked";
  visits?: number;
  achievements?: AchievementCounts;
  topFriends?: TopFriend[];
};

function ProfileActions({
  profile,
  followState,
  isOwner,
  relationship,
}: Pick<HeaderProps, "profile" | "followState" | "isOwner" | "relationship">) {
  if (isOwner) {
    return (
      <Link href="/settings" className="btn btn-ghost">
        Editar perfil
      </Link>
    );
  }

  return (
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
        relationship={relationship ?? "none"}
      />
    </>
  );
}

export function ProfileHeader({
  profile,
  stats,
  viewerId,
  followState,
  isOwner,
  relationship = "none",
  visits = 0,
  achievements,
  topFriends = [],
}: HeaderProps) {
  const y2k = profile.profile_style === "y2k";
  const presence = presenceInfo(profile.last_seen_at);
  const actions = (
    <ProfileActions
      profile={profile}
      followState={followState}
      isOwner={isOwner}
      relationship={relationship}
    />
  );

  return (
    <section className={cn("border-b border-line bg-surface", y2k && "chupa-y2k-section")}>
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

      {y2k ? (
        <div className="chupa-y2k">
          <div className="chupa-y2k-marquee" aria-hidden>
            <span>
              ✦ {profile.display_name} ✦ @{profile.username} ✦{" "}
              {profile.status_text || "bem-vindo ao meu perfil"} ✦ melhor visto em 1024×768 ✦{" "}
              ✦ {profile.display_name} ✦ @{profile.username} ✦{" "}
              {profile.status_text || "bem-vindo ao meu perfil"} ✦ melhor visto em 1024×768 ✦
            </span>
          </div>

          <div className="flex justify-end px-3 pt-2">{actions}</div>

          <div className="grid gap-3 p-3 sm:grid-cols-[252px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="chupa-y2k-window">
                <div className="chupa-y2k-bar flex items-center justify-between gap-2">
                  <span className="truncate">✦ {profile.display_name} ✦</span>
                  <span className="shrink-0 normal-case">@{profile.username}</span>
                </div>

                <div className="p-3 text-center">
                  <div className="mx-auto w-fit">
                    <Avatar
                      profile={profile}
                      size={112}
                      className="ring-4 ring-white/70"
                      link={false}
                    />
                  </div>

                  <h1
                    className={cn(
                      "chupa-y2k-name mt-2 text-2xl font-bold leading-tight",
                      nameFontClass(profile.name_font),
                    )}
                  >
                    {profile.display_name}
                  </h1>

                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                    {profile.is_verified && <VerifiedBadge size={16} />}
                    {profile.is_admin && <AdminBadge size={16} />}
                    <FlagBadge flagId={profile.flag} size={15} />
                    {profile.is_private && (
                      <span className="chip !py-0.5">
                        <Lock size={10} /> privado
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-[0.7rem] text-muted">
                    <span className="chupa-y2k-blink mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                    {presence?.tone === "online"
                      ? "online agora"
                      : presence?.label ?? "offline"}
                  </p>

                  {(profile.status_text || profile.status_emoji) && (
                    <div className="mt-2 flex justify-center">
                      <StatusLine emoji={profile.status_emoji} text={profile.status_text} />
                    </div>
                  )}

                  <div className="chupa-y2k-table mt-2 text-left">
                    <p>
                      <span>nome</span>
                      <span className="truncate">{profile.display_name}</span>
                    </p>
                    <p>
                      <span>local</span>
                      <span className="truncate">{profile.location || "—"}</span>
                    </p>
                    <p>
                      <span>entrou</span>
                      <span>{formatDate(profile.created_at)}</span>
                    </p>
                    {profile.website && (
                      <p>
                        <span>site</span>
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="truncate text-accent hover:underline"
                        >
                          {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      </p>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                    <Link
                      href={`/u/${profile.username}/following`}
                      className="chupa-y2k-stat hover:bg-accent-soft"
                    >
                      <strong>{formatCount(stats.following)}</strong>
                      <span>amigos</span>
                    </Link>
                    <Link
                      href={`/u/${profile.username}/followers`}
                      className="chupa-y2k-stat hover:bg-accent-soft"
                    >
                      <strong>{formatCount(stats.followers)}</strong>
                      <span>seguidores</span>
                    </Link>
                    <div className="chupa-y2k-stat">
                      <strong>{profile.show_stats || isOwner ? formatCount(stats.posts) : "—"}</strong>
                      <span>posts</span>
                    </div>
                    <div className="chupa-y2k-stat">
                      <strong>
                        {profile.show_visits || isOwner ? formatCount(visits) : "—"}
                      </strong>
                      <span>visitas</span>
                    </div>
                  </div>

                  {profile.song_url ? (
                    <ProfileMusic
                      url={profile.song_url}
                      title={profile.favorite_song}
                      artist={profile.favorite_song_artist}
                    />
                  ) : profile.favorite_song || profile.favorite_song_artist ? (
                    <div className="mt-2 flex justify-center">
                      <FavoriteSong
                        song={profile.favorite_song}
                        artist={profile.favorite_song_artist}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="chupa-y2k-window">
                <div className="chupa-y2k-bar">♥ recado rápido</div>
                <div className="space-y-1.5 p-2.5 text-[0.72rem] text-muted">
                  <p>
                    {isOwner
                      ? "Seu cantinho no estilo anos 2000. Edite o visual em Configurações."
                      : `Manda um oi para @${profile.username} — todo mundo é bem-vindo.`}
                  </p>
                  <p className="flex items-center gap-1 text-[0.68rem]">
                    <Music2 size={10} className="text-accent" />
                    {profile.favorite_song
                      ? `ouvindo ${profile.favorite_song}`
                      : "nenhuma música fixada"}
                  </p>
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-3">
              <section className="chupa-y2k-window">
                <div className="chupa-y2k-bar">♥ sobre mim</div>
                <div className="p-3">
                  {profile.bio ? (
                    <p className="prose-chupa text-[0.9rem] leading-relaxed">{profile.bio}</p>
                  ) : (
                    <p className="text-sm text-muted">
                      {isOwner
                        ? "Você ainda não escreveu sua bio. Conte quem você é em Configurações."
                        : "Essa pessoa ainda não escreveu nada sobre si."}
                    </p>
                  )}
                  {achievements && <ProfileBadges counts={achievements} />}
                </div>
              </section>

              <section className="chupa-y2k-window">
                <div className="chupa-y2k-bar flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Star size={10} /> top 8
                  </span>
                  <Link
                    href={`/u/${profile.username}/following`}
                    className="normal-case hover:underline"
                  >
                    ver todos
                  </Link>
                </div>
                <div className="p-3">
                  {topFriends.length === 0 ? (
                    <p className="text-xs text-muted">
                      Ainda sem amigos por aqui. Quando seguir alguém, essa pessoa ganha um
                      quadradinho no Top 8.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-x-2 gap-y-3">
                      {topFriends.map((friend) => (
                        <Link
                          key={friend.id}
                          href={`/u/${friend.username}`}
                          className="group text-center"
                        >
                          <Avatar
                            profile={friend}
                            size={56}
                            className="mx-auto ring-1 ring-white/70 transition-transform group-hover:-translate-y-0.5"
                            link={false}
                          />
                          <span className="mt-1 flex items-center justify-center gap-0.5 truncate text-[0.63rem] font-semibold">
                            <span className="truncate">{friend.display_name}</span>
                            {friend.is_verified && <VerifiedBadge size={10} />}
                          </span>
                          <span className="block truncate text-[0.58rem] text-muted">
                            @{friend.username}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="chupa-y2k-window">
                <div className="chupa-y2k-bar">detalhes</div>
                <div className="grid gap-2 p-3 text-[0.75rem] sm:grid-cols-2">
                  <p className="flex items-center gap-1.5 text-muted">
                    <CalendarDays size={12} className="text-accent" /> desde{" "}
                    {new Date(profile.created_at).getFullYear()}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted">
                    <MapPin size={12} className="text-accent" /> {profile.location || "sem local"}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted">
                    <Heart size={12} className="text-accent" />{" "}
                    {formatCount(achievements?.likes ?? 0)} curtidas recebidas
                  </p>
                  <p className="flex items-center gap-1.5 text-muted">
                    <Eye size={12} className="text-accent" /> {formatCount(visits)} visitas
                  </p>
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <LinkIcon size={12} />{" "}
                      {profile.website.replace(/^https?:\/\//, "").slice(0, 34)}
                    </a>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="chupa-y2k-footer">
            <span>
              layout por @{profile.username} ✦ perfil do ChupaSocial ✦ {formatCount(visits)}{" "}
              visitas
            </span>
            <span className="ml-auto hidden sm:inline">♥ obrigado pela visita ♥</span>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 sm:px-6">
          <div className="mb-1 -mt-10 flex items-end justify-between gap-3">
            <Avatar profile={profile} size={84} className="ring-4 ring-surface" link={false} />
            <div className="mb-1 flex items-center gap-2">{actions}</div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={cn(
                  "text-xl font-semibold leading-tight",
                  nameFontClass(profile.name_font),
                )}
              >
                {profile.display_name}
              </h1>
              {profile.is_verified && <VerifiedBadge size={18} />}
              {profile.is_admin && <AdminBadge size={18} />}
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
              <p className="prose-chupa mt-3 max-w-xl text-[0.93rem] leading-relaxed">
                {profile.bio}
              </p>
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

            {profile.song_url ? (
              <ProfileMusic
                url={profile.song_url}
                title={profile.favorite_song}
                artist={profile.favorite_song_artist}
              />
            ) : (
              (profile.favorite_song || profile.favorite_song_artist) && (
                <div className="mt-2">
                  <FavoriteSong
                    song={profile.favorite_song}
                    artist={profile.favorite_song_artist}
                  />
                </div>
              )
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
              {achievements && (
                <span
                  className="inline-flex items-center gap-1 text-muted"
                  title="Curtidas recebidas nas suas publicações"
                >
                  <Heart size={12} /> {formatCount(achievements.likes)}{" "}
                  <span className="text-muted">curtidas recebidas</span>
                </span>
              )}
              {(profile.show_visits || isOwner) && visits > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-muted"
                  title="Visitas ao perfil"
                >
                  <Eye size={12} /> {formatCount(visits)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
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
