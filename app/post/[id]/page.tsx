import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Comments } from "@/components/comments";
import { PostCard } from "@/components/post-card";
import { fetchComments, fetchPostById } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/post/${id}`);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileData) redirect("/login?erro=sessao");

  const post = await fetchPostById(id);
  if (!post) notFound();

  const comments = await fetchComments(id);

  return (
    <AppShell>
      <div className="sticky top-[57px] z-20 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:px-5 lg:top-0">
        <Link href="/" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold">Publicação</h1>
      </div>

      <PostCard post={post} viewerId={user.id} detail />
      <Comments
        postId={id}
        comments={comments}
        viewerId={user.id}
        viewer={profileData as Profile}
      />
    </AppShell>
  );
}
