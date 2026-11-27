import { createClient } from "@/lib/supabase/server";

const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,40})/gu;
const MENTION_PATTERN = /@([a-z0-9_]{3,20})/gi;

export function normalizeTag(tag: string) {
  return tag
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 40);
}

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const tag = normalizeTag(match[1]);
    if (tag.length >= 2) found.add(tag);
  }
  return [...found];
}

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    found.add(match[1].toLowerCase());
  }
  return [...found].slice(0, 10);
}

export type TrendingTag = { tag: string; count: number };

/**
 * Trending calculado sobre as publicações dos últimos 7 dias. Sem tabela
 * auxiliar: o volume do app não justifica manter contadores materializados.
 */
export async function fetchTrendingTags(limit = 6): Promise<TrendingTag[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("posts")
    .select("content")
    .is("root_post_id", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ content: string | null }>) {
    for (const tag of extractHashtags(row.content ?? "")) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
