export type MusicKind = "audio" | "youtube" | "spotify" | "soundcloud" | "deezer" | "apple";

export type MusicSource = {
  kind: MusicKind;
  embedUrl: string;
  /** Algunas plataformas só tocam depois de um clique; o player adiciona autoplay. */
  autoplayUrl?: string;
  label: string;
  /** Link original, para abrir no app/site. */
  url: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "episode", "artist", "show"]);
const DEEZER_TYPES = new Set(["track", "album", "playlist"]);

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Converte o que a pessoa colou em algo tocável no perfil.
 * Devolve null para links desconhecidos — a validação do servidor usa isso.
 */
export function parseMusicUrl(raw: string | null | undefined): MusicSource | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const url = safeUrl(value);
  if (!url) return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = decodeURIComponent(url.pathname);

  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0] ?? "";
    if (YOUTUBE_ID.test(id)) {
      return {
        kind: "youtube",
        label: "YouTube",
        url: value,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        autoplayUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`,
      };
    }
    return null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const id =
      url.searchParams.get("v") ??
      path.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] ??
      "";
    if (YOUTUBE_ID.test(id)) {
      return {
        kind: "youtube",
        label: "YouTube",
        url: value,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        autoplayUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`,
      };
    }
    return null;
  }

  if (host === "open.spotify.com" || host === "play.spotify.com") {
    const match = path.match(/\/(track|album|playlist|episode|artist|show)\/([A-Za-z0-9]+)/);
    if (!match || !SPOTIFY_TYPES.has(match[1])) return null;
    return {
      kind: "spotify",
      label: "Spotify",
      url: value,
      embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`,
    };
  }

  if (host === "soundcloud.com" || host === "m.soundcloud.com" || host === "on.soundcloud.com") {
    return {
      kind: "soundcloud",
      label: "SoundCloud",
      url: value,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`,
    };
  }

  if (host === "deezer.com" || host === "link.deezer.com") {
    if (host === "link.deezer.com") return null;
    const match = path.match(/\/(track|album|playlist)\/(\d+)/);
    if (!match || !DEEZER_TYPES.has(match[1])) return null;
    return {
      kind: "deezer",
      label: "Deezer",
      url: value,
      embedUrl: `https://widget.deezer.com/widget/dark/${match[1]}/${match[2]}`,
      autoplayUrl: `https://widget.deezer.com/widget/dark/${match[1]}/${match[2]}?autoplay=true`,
    };
  }

  if (host === "music.apple.com" || host === "embed.music.apple.com") {
    return {
      kind: "apple",
      label: "Apple Music",
      url: value,
      embedUrl: `https://embed.music.apple.com${url.pathname}${url.search}`,
      autoplayUrl: `https://embed.music.apple.com${url.pathname}${url.search}`,
    };
  }

  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/i.test(path)) {
    return { kind: "audio", label: "Áudio", url: value, embedUrl: value };
  }

  return null;
}
