import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { Landing } from "@/components/landing";
import { RightRail } from "@/components/right-rail";
import { fetchFeed } from "@/lib/queries";
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

  const [posts, { data: membershipRows }] = await Promise.all([
    fetchFeed({
      mode: tab === "seguindo" ? "following" : "all",
      viewerId: user.id,
      limit: 12,
    }),
    supabase
      .from("community_members")
      .select("community_id, communities(id, name, slug)")
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
