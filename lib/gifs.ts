import type { GifItem } from "@/lib/types";

const GIPHY_API = "https://api.giphy.com/v1/gifs";
const LIMIT = 24;
const RATING = "pg-13";
const PUBLIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function giphyItem(id: string, title: string): GifItem {
  return {
    id,
    provider: "giphy",
    title: title || "GIF",
    url: `https://media.giphy.com/media/${id}/giphy.gif`,
    preview: `https://media.giphy.com/media/${id}/giphy.webp`,
  };
}

function decodeTitle(raw: string) {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw.replace(/\\"/g, '"').replace(/\\u0027/g, "'");
  }
}

/** Extrai os GIFs do payload RSC que a busca pública do Giphy entrega. */
function parsePublicGiphy(html: string): GifItem[] {
  let decoded = "";
  const pushRe = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let push: RegExpExecArray | null;
  while ((push = pushRe.exec(html))) {
    try {
      decoded += JSON.parse(push[1]) as string;
    } catch {
      // fragmento inválido: ignora e continua
    }
  }

  const items: GifItem[] = [];
  const seen = new Set<string>();
  const itemRe = /\{"type":"gif","id":"([A-Za-z0-9]+)"[\s\S]{0,600}?"title":"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(decoded)) && items.length < LIMIT) {
    const [, id, rawTitle] = match;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(giphyItem(id, decodeTitle(rawTitle)));
  }

  if (items.length === 0) {
    const mediaRe = /media\/([A-Za-z0-9]{8,})\/giphy\.gif/g;
    while ((match = mediaRe.exec(html)) && items.length < LIMIT) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(giphyItem(id, "GIF"));
    }
  }

  return items;
}

async function searchOfficial(term: string, key: string): Promise<GifItem[]> {
  const params = new URLSearchParams({
    api_key: key,
    limit: String(LIMIT),
    rating: RATING,
    lang: "pt",
  });
  if (term) params.set("q", term);

  const response = await fetch(`${GIPHY_API}/${term ? "search" : "trending"}?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`giphy_${response.status}`);

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      title?: string;
      images?: Record<string, { url?: string; webp?: string }>;
    }>;
  };

  return (payload.data ?? [])
    .filter((gif) => Boolean(gif.id))
    .map((gif) => {
      const images = gif.images ?? {};
      const full = images.downsized_medium?.url ?? images.original?.url;
      const preview = images.fixed_height?.webp ?? images.fixed_height?.url ?? full;
      return {
        id: gif.id as string,
        provider: "giphy",
        title: gif.title || "GIF",
        url: full || `https://media.giphy.com/media/${gif.id}/giphy.gif`,
        preview: preview || `https://media.giphy.com/media/${gif.id}/giphy.webp`,
      } satisfies GifItem;
    });
}

async function searchPublic(term: string): Promise<GifItem[]> {
  const url = term
    ? `https://giphy.com/search/${encodeURIComponent(term)}`
    : "https://giphy.com/";
  const response = await fetch(url, {
    headers: {
      "user-agent": PUBLIC_USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`giphy_${response.status}`);
  return parsePublicGiphy(await response.text());
}

export async function searchGifs(query: string): Promise<GifItem[]> {
  const term = query.trim().slice(0, 60);
  const key = process.env.GIPHY_API_KEY;

  if (key) {
    try {
      return await searchOfficial(term, key);
    } catch {
      // cai para a busca pública abaixo
    }
  }

  return searchPublic(term);
}
