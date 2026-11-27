import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Hash } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FeedList } from "@/components/feed-list";
import { fetchFeed } from "@/lib/queries";
import { fetchTrendingTags, normalizeTag } from "@/lib/hashtags";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${normalizeTag(decodeURIComponent(tag))}` };
}

export default async function HashtagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const clean = normalizeTag(decodeURIComponent(tag));
  if (!clean) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/hashtag/${encodeURIComponent(clean)}`);

  const [posts, trending] = await Promise.all([
    fetchFeed({ mode: "hashtag", tag: clean, viewerId: user.id, limit: 12 }),
    fetchTrendingTags(5),
  ]);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Hash size={17} />
          </span>
          <div>
            <h1 className="text-base font-semibold">{clean}</h1>
            <p className="text-xs text-muted">
              Publicações com a hashtag #{clean}
            </p>
          </div>
        </div>

        {trending.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trending.map((item) => (
              <Link
                key={item.tag}
                href={`/hashtag/${encodeURIComponent(item.tag)}`}
                className={
                  item.tag === clean
                    ? "rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                    : "rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                }
              >
                #{item.tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      <FeedList
        initialPosts={posts}
        viewerId={user.id}
        mode="hashtag"
        tag={clean}
        emptyTitle={`Nada com #${clean} ainda`}
        emptyDescription="Publique algo com essa hashtag para começar a conversa."
      />
    </AppShell>
  );
}
