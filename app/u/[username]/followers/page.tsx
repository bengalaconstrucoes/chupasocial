import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { RemoveFollowerButton } from "@/components/remove-follower-button";
import { fetchFollowList, fetchFollowState, fetchProfileByUsername } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/u/${username}/followers`);

  const profile = await fetchProfileByUsername(username);
  if (!profile) notFound();

  const isOwner = user.id === profile.id;
  const { following } = await fetchFollowState(user.id, profile.id);
  if (profile.is_private && !isOwner && !following) {
    return (
      <AppShell>
        <div className="border-b border-line bg-surface px-5 py-4">
          <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} /> Voltar ao perfil
          </Link>
          <h1 className="mt-2 text-lg font-semibold">Seguidores</h1>
        </div>
        <p className="px-5 py-12 text-center text-sm text-muted">
          Esta lista é privada. Siga @{profile.username} para vê-la.
        </p>
      </AppShell>
    );
  }

  const people = await fetchFollowList(profile.id, "followers");
  const states = await Promise.all(
    people.map((person) => fetchFollowState(user.id, person.id)),
  );

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-5 py-4">
        <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> Voltar ao perfil
        </Link>
        <h1 className="mt-2 text-lg font-semibold">Seguidores de @{profile.username}</h1>
      </div>

      {people.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">Ainda não há seguidores por aqui.</p>
      ) : (
        <ul className="divide-y divide-line">
          {people.map((person, index) => (
            <li key={person.id} className="flex items-center gap-3 bg-surface px-4 py-3 sm:px-5">
              <Avatar profile={person} size={40} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${person.username}`} className="block truncate text-sm font-semibold hover:underline">
                  {person.display_name}
                </Link>
                <p className="truncate text-xs text-muted">@{person.username}</p>
              </div>
              {person.id !== user.id &&
                (isOwner ? (
                  <RemoveFollowerButton
                    followerId={person.id}
                    displayName={person.display_name}
                  />
                ) : (
                  <FollowButton
                    targetId={person.id}
                    initialFollowing={states[index].following}
                    initialRequested={states[index].requested}
                    isPrivate={person.is_private}
                    size="sm"
                  />
                ))}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
