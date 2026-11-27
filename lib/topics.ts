import { createClient } from "@/lib/supabase/server";

/**
 * Assuntos em alta: palavras e expressões repetidas nas publicações recentes,
 * sem depender de hashtags. Hashtags, menções e links são removidos antes da
 * contagem para que o assunto apareça pelo texto do post.
 */
const STOPWORDS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por para pra pro com sem sob sobre
   e ou mas que se como quando onde porque pois ja nao sim tambem muito mais menos meu minha meus minhas
   seu sua seus suas eu tu ele ela nos vos eles elas voce voces isso isto aquilo esse essa este esta
   aquele aquela foi era ser estar esta estou tem tinha ter vamos vai vou ai aqui ali entao tipo
   hoje agora ainda depois antes so bem tudo todo toda todos todas nada alguem ninguem cada
   the and you for not with this that have are was but from they will what about just
   hj kkk kkkk kkkkk rs rsrs lol mano gente coisas coisa dia noite cara
   # @ http https www com br`.split(/\s+/),
);

const WORD = /[\p{L}][\p{L}\p{N}_]{2,}/gu;

export type TrendingTopic = {
  topic: string;
  label: string;
  count: number;
  authors: number;
};

export async function fetchTrendingTopics(limit = 6): Promise<TrendingTopic[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("posts")
    .select("author_id, content")
    .is("root_post_id", null)
    .is("repost_of", null)
    .is("hidden_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);

  const counts = new Map<string, { count: number; authors: Set<string> }>();

  function bump(key: string, authorId: string) {
    const entry = counts.get(key) ?? { count: 0, authors: new Set<string>() };
    entry.count += 1;
    entry.authors.add(authorId);
    counts.set(key, entry);
  }

  for (const row of (data ?? []) as Array<{ author_id: string; content: string | null }>) {
    const clean = (row.content ?? "")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/@[a-z0-9_]+/gi, " ")
      .replace(/#[\p{L}\p{N}_]+/gu, " ");

    const words = [...clean.matchAll(WORD)]
      .map((match) => match[0].toLowerCase())
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word));

    const seen = new Set<string>();
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      if (!seen.has(word)) {
        bump(word, row.author_id);
        seen.add(word);
      }

      const next = words[index + 1];
      if (next && !STOPWORDS.has(next)) {
        const phrase = `${word} ${next}`;
        if (!seen.has(phrase)) {
          bump(phrase, row.author_id);
          seen.add(phrase);
        }
      }
    }
  }

  const scored = [...counts.entries()]
    .map(([key, value]) => {
      const words = key.split(" ");
      // Frases valem mais: são assuntos, não palavras soltas.
      const weight = words.length > 1 ? 1.8 : 1;
      const score = value.count * weight + value.authors.size * 0.8;
      return {
        key,
        count: value.count,
        authors: value.authors.size,
        score,
      };
    })
    .filter((entry) => entry.count >= 2 && entry.authors >= 1)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  // Evita repetir a mesma palavra em uma frase e na versão solta.
  const chosen: typeof scored = [];
  for (const entry of scored) {
    const words = entry.key.split(" ");
    if (
      chosen.some((other) => {
        if (other.key === entry.key) return true;
        if (words.length > 1 && other.key.includes(entry.key)) return true;
        if (other.key.split(" ").length > 1 && entry.key.includes(other.key)) return true;
        return false;
      })
    ) {
      continue;
    }
    chosen.push(entry);
    if (chosen.length >= limit) break;
  }

  return chosen.map((entry) => ({
    topic: entry.key,
    label: entry.key.charAt(0).toUpperCase() + entry.key.slice(1),
    count: entry.count,
    authors: entry.authors,
  }));
}
