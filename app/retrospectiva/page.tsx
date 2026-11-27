import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarHeart, Heart, Sparkles, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { fetchRetrospective } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = { title: "Retrospectiva" };

export default async function RetrospectivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/retrospectiva");

  const data = await fetchRetrospective(user.id);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Sparkles size={16} className="text-accent" /> Sua retrospectiva de {data.year}
        </h1>
        <p className="text-xs text-muted">Um resumo do que você fez por aqui neste ano.</p>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="chupa-card p-4">
            <p className="text-xs text-muted">Publicações</p>
            <p className="mt-1 text-2xl font-bold">{formatCount(data.posts)}</p>
          </div>
          <div className="chupa-card p-4">
            <p className="inline-flex items-center gap-1 text-xs text-muted">
              <Heart size={12} /> Curtidas recebidas
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCount(data.likes)}</p>
          </div>
          <div className="chupa-card p-4">
            <p className="inline-flex items-center gap-1 text-xs text-muted">
              <UserPlus size={12} /> Novos seguidores
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCount(data.followersGained)}</p>
          </div>
        </div>

        <div className="chupa-card space-y-3 p-4 text-sm">
          {data.topHashtag ? (
            <p>
              Sua hashtag mais usada foi{" "}
              <Link href={`/hashtag/${data.topHashtag}`} className="font-semibold text-accent hover:underline">
                #{data.topHashtag}
              </Link>
              .
            </p>
          ) : (
            <p className="text-muted">Você ainda não usou hashtags este ano.</p>
          )}

          {data.busiestMonth && (
            <p className="inline-flex items-center gap-1.5">
              <CalendarHeart size={14} className="text-accent" />
              Seu mês mais ativo foi <strong>{data.busiestMonth}</strong>.
            </p>
          )}

          {data.bestPost && (
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">Sua publicação mais curtida</p>
              <Link href={`/post/${data.bestPost.id}`} className="mt-1 block text-sm hover:underline">
                {data.bestPost.content.slice(0, 160) || "publicação com mídia"}
              </Link>
              <p className="mt-1 text-xs text-muted">{formatCount(data.bestPost.likes)} curtidas</p>
            </div>
          )}

          {data.posts === 0 && (
            <p className="text-muted">
              Nada publicado em {data.year} ainda. Bora abrir o feed e começar?
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
