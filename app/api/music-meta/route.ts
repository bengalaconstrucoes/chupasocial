import { NextResponse } from "next/server";
import { parseMusicUrl } from "@/lib/music";

const CACHE_SECONDS = 60 * 60 * 24;

type Meta = { title: string; artist: string };

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function decode(value: string) {
  return clean(
    value
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

/** Tira sujeira comum dos títulos de vídeo: "(Official Video)", "[Lyrics]", "| YouTube". */
function stripNoise(value: string) {
  return clean(
    value
      .replace(
        /\((?:official\s*(?:music\s*)?(?:video|audio|lyric[s]?\s*video)?|lyrics?|audio|video|visualizer|hd|4k|remaster(?:ed)?)\)/gi,
        "",
      )
      .replace(/\[(?:official\s*(?:music\s*)?(?:video|audio)?|lyrics?|audio|video|hd|4k)\]/gi, "")
      .replace(/\s*[-|·]\s*(youtube|spotify|soundcloud|deezer|apple music)\s*$/i, ""),
  );
}

async function getJson(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ChupaSocial/1.0; +https://chupasocial.vercel.app)" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ChupaSocial/1.0; +https://chupasocial.vercel.app)" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function pageMeta(html: string) {
  const pick = (property: string) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decode(match[1]);
    }
    return "";
  };
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return {
    title: pick("og:title") || (titleTag ? decode(titleTag[1]) : ""),
    description: pick("og:description"),
  };
}

/** "Música by Artista" (SoundCloud/Apple) vira { artist, title }. */
function parseByLine(value: string): Meta | null {
  const match = value.match(/^(.*?)\s+by\s+(.+?)(?:\s+on Apple Music|\s*\|.*)?$/i);
  if (!match) return null;
  const title = stripNoise(match[1]);
  const artist = clean(match[2]);
  if (!title || !artist) return null;
  return { title, artist };
}

/** "Artista - Música" vira { artist, title }. */
function splitArtist(title: string, fallbackArtist = ""): Meta {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    const second = rest.join(" - ");
    if (first && second) return { artist: clean(first), title: clean(second) };
  }
  return { artist: clean(fallbackArtist), title: clean(title) };
}

async function resolve(kind: string, url: string): Promise<Meta | null> {
  if (kind === "youtube") {
    const data = await getJson(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    const rawTitle = clean(String(data?.title ?? ""));
    if (!rawTitle) return null;
    const channel = clean(String(data?.author_name ?? "")).replace(/\s*-\s*Topic$/i, "");
    const title = stripNoise(rawTitle);
    return splitArtist(title, channel);
  }

  if (kind === "soundcloud") {
    const data = await getJson(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    const rawTitle = clean(String(data?.title ?? ""));
    if (!rawTitle) return null;
    const uploader = clean(String(data?.author_name ?? ""));
    return parseByLine(rawTitle) ?? splitArtist(stripNoise(rawTitle), uploader);
  }

  if (kind === "spotify") {
    const data = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    const html = await getHtml(url);
    const meta = pageMeta(html);
    const title = stripNoise(clean(String(data?.title ?? "")) || meta.title);
    const artist =
      meta.description.split("·")[0]?.trim() ||
      meta.description.match(/Listen to .+? by (.+?) on Spotify/i)?.[1]?.trim() ||
      "";
    if (!title) return null;
    return { title, artist: clean(artist) };
  }

  if (kind === "deezer") {
    const match = url.match(/\/(track|album|playlist)\/(\d+)/);
    if (!match) return null;
    const data = await getJson(`https://api.deezer.com/${match[1]}/${match[2]}`);
    if (!data) return null;
    const title = clean(String(data.title ?? ""));
    const artist = clean(
      String(
        (data.artist as { name?: string } | undefined)?.name ??
          (data.creator as { name?: string } | undefined)?.name ??
          "",
      ),
    );
    if (!title) return null;
    return { title, artist };
  }

  if (kind === "apple") {
    const html = await getHtml(url);
    const meta = pageMeta(html);
    if (!meta.title) return null;
    const parsed =
      parseByLine(meta.title.replace(/^\u200e\s*/, "")) ??
      parseByLine(meta.description.match(/Listen to (.+?) on Apple Music/i)?.[1] ?? "");
    if (parsed) return parsed;

    const byArtist = meta.description.match(/by (.+?) on Apple Music/i)?.[1];
    const title = stripNoise(
      meta.title.replace(/\s*[-–—]\s*(Single|EP|Album)\s+by\s+.+$/i, "").replace(/\s+on Apple Music$/i, ""),
    );
    return title ? { title, artist: clean(byArtist ?? "") } : null;
  }

  if (kind === "audio") {
    const file = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
    if (!file) return null;
    return splitArtist(file.replace(/[_-]+/g, " "));
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url") ?? "";
  const source = parseMusicUrl(raw);

  if (!source) {
    return NextResponse.json({ error: "Link não reconhecido." }, { status: 400 });
  }

  const meta = await resolve(source.kind, source.url);
  if (!meta || !meta.title) {
    return NextResponse.json({ title: "", artist: "" }, { status: 200 });
  }

  return NextResponse.json(
    { title: meta.title, artist: meta.artist },
    {
      headers: {
        "cache-control": `public, max-age=3600, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
