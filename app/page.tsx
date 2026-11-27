import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { Landing } from "@/components/landing";
import { RightRail } from "@/components/right-rail";
import { StoryTray } from "@/components/stories";
import { Memories } from "@/components/memories";
import { fetchFeed, fetchMemories, fetchStories } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; aviso?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        {params.aviso === "conta-excluida" && (
          <div className="bg-surface-2 px-5 py-2 text-center text-sm text-muted">
            Sua conta e seus dados foram removidos. Obrigado por ter passado por aqui.
          </div>
        )}
        {params.aviso === "conta-desativada" && (
          <div className="bg-surface-2 px-5 py-2 text-center text-sm text-muted">
            Conta desativada. Entre novamente para reativá-la.
          </div>
        )}
        <Landing />
      </>
    );
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileData) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-xl font-semibold">Perfil não encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          Sua conta existe, mas o perfil não foi carregado. Saia e entre novamente.
        </p>
        <Link href="/login" className="btn btn-primary mt-5">
          Ir para o login
        </Link>
      </div>
    );
  }

  const profile = profileData as Profile;
  const tab = params.tab === "seguindo" ? "seguindo" : "todos";

  const [posts, stories, memories, { data: membershipRows }] = await Promise.all([
    fetchFeed({
      mode: tab === "seguindo" ? "following" : "all",
      viewerId: user.id,
      limit: 12,
      personalize: tab === "todos",
    }),
    fetchStories(user.id),
    fetchMemories(user.id),
    supabase
      .from("community_members")
      .select("community_id, communities(id, name, slug, image_url)")
      .eq("user_id", user.id)
      .limit(30),
  ]);

  const communities = (membershipRows ?? [])
    .map((row: any) => row.communities)
    .filter(Boolean)
    .map((community: any) => ({
      id: community.id,
      name: community.name,
      slug: community.slug,
      image_url: (community.image_url as string | null) ?? null,
    }));

  return (
    <AppShell aside={<RightRail viewerId={user.id} />}>
      <div className="border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-5">
        <div className="flex items-center gap-1">
          {[
            { key: "todos", label: "Para você" },
            { key: "seguindo", label: "Seguindo" },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.key === "todos" ? "/" : "/?tab=seguindo"}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === item.key
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/communities"
            className="ml-auto text-xs text-muted hover:text-accent sm:ml-0 sm:pl-3"
          >
            comunidades
          </Link>
        </div>
      </div>

      {communities.length > 0 && (
        <div className="border-b border-line bg-surface px-4 py-2.5 sm:px-5">
          <ul className="flex items-center gap-3 overflow-x-auto pb-0.5">
            <li className="shrink-0">
              <Link
                href="/communities"
                className="flex flex-col items-center gap-1 text-[0.62rem] text-muted hover:text-accent"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-line text-lg">
                  +
                </span>
                todas
              </Link>
            </li>
            {communities.map((community) => (
              <li key={community.id} className="shrink-0">
                <Link
                  href={`/communities/${community.slug}`}
                  className="flex w-14 flex-col items-center gap-1 text-center"
                  title={community.name}
                >
                  <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-line bg-accent-soft text-accent">
                    {community.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={community.image_url}
                        alt={`Foto da comunidade ${community.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold">
                        {community.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-[0.62rem] text-muted">
                    {community.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StoryTray groups={stories} viewer={profile} />

      <Memories posts={memories} />

      {params.aviso === "senha-atualizada" && (
        <p className="border-b border-line bg-surface px-4 py-2 text-sm text-ok sm:px-5">
          Senha atualizada com sucesso.
        </p>
      )}

      <Composer profile={profile} communities={communities} />

      <FeedList
        initialPosts={posts}
        viewerId={user.id}
        mode={tab === "seguindo" ? "following" : "all"}
        emptyTitle={tab === "seguindo" ? "Seu feed de seguidos está vazio" : "O feed está começando"}
        emptyDescription={
          tab === "seguindo"
            ? "Siga pessoas para ver as publicações delas aqui. Enquanto isso, explore o feed geral e as comunidades."
            : "Publique a primeira coisa ou convide alguém para começar a conversa."
        }
      />
    </AppShell>
  );
}
