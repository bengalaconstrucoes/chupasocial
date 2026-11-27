import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { fetchSavedPosts } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Salvos" };

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/saved");

  const posts = await fetchSavedPosts(user.id);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="text-base font-semibold">Salvos</h1>
        <p className="text-xs text-muted">
          Coleção privada: só você vê o que guardou aqui.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Bookmark size={24} className="mx-auto text-muted" />
          <h2 className="mt-3 text-base font-semibold">Nada salvo ainda</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Toque no marcador de qualquer publicação para guardá-la aqui, sem curtir e sem
            ninguém saber.
          </p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} viewerId={user.id} />)
      )}
    </AppShell>
  );
}
