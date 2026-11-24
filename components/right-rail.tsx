import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function RightRail({ viewerId }: { viewerId: string }) {
  const supabase = await createClient();

  const [{ data: followRows }, { data: communityRows }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", viewerId),
    supabase
      .from("communities")
      .select("id, slug, name, description, members:community_members(count)")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const followed = new Set((followRows ?? []).map((row: any) => row.following_id as string));

  let suggestions: Profile[] = [];
  if (followed.size < 30) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", viewerId)
      .eq("is_private", false)
      .is("deactivated_at", null)
      .order("created_at", { ascending: false })
      .limit(24);
    suggestions = ((data ?? []) as Profile[]).filter((profile) => !followed.has(profile.id)).slice(0, 4);
  }

  return (
    <div className="space-y-4">
      <section className="chupa-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Quem seguir</h2>
          <Link href="/search" className="text-xs text-accent hover:underline">
            buscar
          </Link>
        </div>

        {suggestions.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            Você já segue todo mundo por aqui. Explore a busca para encontrar mais gente.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {suggestions.map((profile) => (
              <li key={profile.id} className="flex items-center gap-2.5">
                <Avatar profile={profile} size={34} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${profile.username}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {profile.display_name}
                  </Link>
                  <p className="truncate text-xs text-muted">@{profile.username}</p>
                </div>
                <FollowButton
                  targetId={profile.id}
                  initialFollowing={false}
                  initialRequested={false}
                  isPrivate={false}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="chupa-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Comunidades</h2>
          <Link href="/communities" className="text-xs text-accent hover:underline">
            ver todas
          </Link>
        </div>

        {(communityRows ?? []).length === 0 ? (
          <div className="mt-3">
            <p className="text-xs text-muted">
              Nenhuma comunidade ainda. Que tal abrir a primeira sobre o assunto que você domina?
            </p>
            <Link href="/communities/new" className="mt-2 inline-flex text-xs font-medium text-accent hover:underline">
              Criar comunidade
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {(communityRows ?? []).map((community: any) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}`}
                  className="flex items-start gap-2.5 rounded-lg p-1.5 -m-1.5 hover:bg-surface-2"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft text-accent">
                    {community.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={community.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Compass size={15} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{community.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {Number(community.members?.[0]?.count ?? 0)} membros
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="chupa-card p-4">
        <h2 className="text-sm font-semibold">Sobre o ChupaSocial</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Feed cronológico, comunidades e mensagens privadas. Sem algoritmo decidindo o que você
          lê.
        </p>
        <Link
          href="/search"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Explorar agora <ArrowRight size={12} />
        </Link>
      </section>
    </div>
  );
}
