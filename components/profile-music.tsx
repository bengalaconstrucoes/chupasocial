"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Music2, Pause, Play } from "lucide-react";
import { parseMusicUrl } from "@/lib/music";
import { cn } from "@/lib/utils";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/**
 * Som do perfil, sem vídeo e sem moldura chamativa: só o botão de play/pause,
 * o nome da música e (quando a pessoa escolher) as cores do texto e do balão.
 */
export function ProfileMusic({
  url,
  title,
  artist,
  textColor,
  bubbleColor,
}: {
  url: string;
  title: string | null;
  artist: string | null;
  textColor?: string | null;
  bubbleColor?: string | null;
}) {
  const source = parseMusicUrl(url);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (source?.kind !== "audio") return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [source?.kind]);

  if (!source) return null;

  const isAudio = source.kind === "audio";

  function toggle() {
    if (isAudio) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        audio
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      } else {
        audio.pause();
        setPlaying(false);
      }
      return;
    }

    // Links de plataforma: montar o embed toca; desmontar pausa.
    setMounted((current) => {
      const next = !current;
      setPlaying(next);
      setLoading(next);
      return next;
    });
  }

  const style = {
    ...(textColor ? { color: textColor } : {}),
    ...(bubbleColor
      ? { background: bubbleColor, borderColor: bubbleColor }
      : {}),
  } as React.CSSProperties;

  return (
    <div className="mt-3 max-w-sm">
      <div
        className="flex items-center gap-2.5 rounded-full border border-line bg-surface/70 px-2 py-1.5 backdrop-blur-sm"
        style={style}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar música do perfil" : "Tocar música do perfil"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            playing
              ? "bg-ink/85 text-surface"
              : "bg-surface-2/80 text-ink hover:bg-surface-2",
          )}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : playing ? (
            <Pause size={13} />
          ) : (
            <Play size={13} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {title || `${source.label} · som do perfil`}
          </p>
          <p className="truncate text-[0.66rem] opacity-70">
            {artist || (playing ? "tocando" : "toque para ouvir")}
          </p>
        </div>

        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
          aria-label={`Abrir no ${source.label}`}
          title={`Abrir no ${source.label}`}
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {isAudio && (
        <audio
          ref={audioRef}
          src={source.embedUrl}
          loop
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {/* YouTube: só o áudio, o quadro fica fora da tela. */}
      {source.kind === "youtube" && mounted && (
        <iframe
          src={source.autoplayUrl ?? source.embedUrl}
          title="Som do perfil no YouTube"
          className="pointer-events-none absolute h-px w-px opacity-0"
          allow={IFRAME_ALLOW}
        />
      )}

      {/* Spotify, SoundCloud, Deezer e Apple: player compacto, só depois do play. */}
      {!isAudio && source.kind !== "youtube" && mounted && (
        <iframe
          src={`${source.embedUrl}${source.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
          title={`Player do ${source.label}`}
          className="mt-2 w-full rounded-xl border border-line"
          height={source.kind === "spotify" ? 80 : source.kind === "soundcloud" ? 110 : 92}
          loading="lazy"
          allow={IFRAME_ALLOW}
          onLoad={() => setLoading(false)}
        />
      )}

      {!isAudio && !mounted && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[0.66rem] opacity-60">
          <Music2 size={10} /> toca só o som no {source.label}
        </p>
      )}
    </div>
  );
}
