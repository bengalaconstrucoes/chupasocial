import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Compass, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { CommunityJoinButton } from "@/components/community-join-button";
import { fetchCommunities } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = { title: "Comunidades" };

export default async function CommunitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/communities");

  const communities = await fetchCommunities(user.id);

  return (
    <AppShell>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-base font-semibold">Comunidades</h1>
          <p className="text-xs text-muted">Assuntos com gente que entende do assunto.</p>
        </div>
        <Link href="/communities/new" className="btn btn-primary !px-3.5 !py-2">
          <Plus size={15} /> Criar
        </Link>
      </div>

      {communities.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Compass size={26} className="mx-auto text-muted" />
          <h2 className="mt-3 text-base font-semibold">Nenhuma comunidade ainda</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Crie a primeira comunidade do ChupaSocial e chame gente para conversar sobre o que você
            gosta.
          </p>
          <Link href="/communities/new" className="btn btn-primary mt-4">
            Criar comunidade
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {communities.map((community) => (
            <li key={community.id} className="flex items-start gap-3 bg-surface px-4 py-4 sm:px-5">
              <Link
                href={`/communities/${community.slug}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-accent-soft text-accent"
              >
                {community.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={community.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Compass size={20} />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link href={`/communities/${community.slug}`} className="text-sm font-semibold hover:underline">
                  {community.name}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                  {community.description || "Sem descrição por enquanto."}
                </p>
                <p className="mt-1 text-[0.7rem] text-muted">
                  {formatCount(community.member_count ?? 0)} membros
                  {community.my_role === "owner" && " · você é dono"}
                  {community.my_role === "moderator" && " · você modera"}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                {community.my_role === "owner" ? (
                  <Link href={`/communities/${community.slug}/settings`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                    gerenciar
                  </Link>
                ) : (
                  <CommunityJoinButton communityId={community.id} isMember={Boolean(community.is_member)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
