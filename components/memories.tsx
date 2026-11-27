import Link from "next/link";
import { History } from "lucide-react";
import type { FeedPost } from "@/lib/types";

/** "Nesse dia": publicações antigas do usuário no mesmo dia e mês. */
export function Memories({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="border-b border-line bg-surface px-4 py-3 sm:px-5" aria-label="Nesse dia">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <History size={14} className="text-accent" /> Nesse dia
      </h2>
      <ul className="mt-2 space-y-2">
        {posts.map((post) => {
          const year = new Date(post.created_at).getFullYear();
          return (
            <li key={post.id}>
              <Link
                href={`/post/${post.id}`}
                className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm hover:border-accent"
              >
                <span className="mt-0.5 shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.62rem] font-semibold text-accent">
                  {year}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {post.content || "publicação com mídia"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
