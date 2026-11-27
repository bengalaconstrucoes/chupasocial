"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { parseMusicUrl } from "@/lib/music";
import { cn } from "@/lib/utils";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/**
 * Música do perfil. Arquivo enviado tenta tocar sozinho; links de plataformas
 * mostram o player oficial, e YouTube/Deezer/Apple só carregam depois do play.
 */
export function ProfileMusic({
  url,
  title,
  artist,
}: {
  url: string;
  title: string | null;
  artist: string | null;
}) {
  const source = parseMusicUrl(url);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (source?.kind !== "audio") return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => setPlaying(true)).catch(() => setBlocked(true));
    }
  }, [source?.kind]);

  if (!source) return null;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setBlocked(false);
        })
        .catch(() => setBlocked(true));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  const isAudio = source.kind === "audio";
  const needsClick = source.kind === "youtube" || source.kind === "deezer" || source.kind === "apple";

  return (
    <div className="mt-3 max-w-md overflow-hidden rounded-xl border border-line bg-surface-2/70">
      <div className="chupa-y2k-bar flex items-center gap-1.5 !py-1">
        <Music2 size={11} />
        <span className="truncate">{source.label} · som do perfil</span>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className="ml-auto rounded p-0.5 hover:bg-black/10"
          aria-label={`Abrir no ${source.label}`}
          title={`Abrir no ${source.label}`}
        >
          <ExternalLink size={11} />
        </a>
      </div>

      <div className="p-2">
        <div className="flex items-center gap-2.5">
          {isAudio ? (
            <>
              <audio ref={audioRef} src={source.embedUrl} loop preload="auto" />
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pausar música do perfil" : "Tocar música do perfil"}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  playing || blocked
                    ? "bg-accent text-accent-ink"
                    : "bg-surface text-accent ring-1 ring-line hover:bg-accent-soft",
                )}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
              <Music2 size={15} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{title || "Música do perfil"}</p>
            <p className="truncate text-[0.68rem] text-muted">
              {artist || "artista desconhecido"}
              {isAudio
                ? blocked
                  ? " · toque no play para ouvir"
                  : playing
                    ? " · tocando"
                    : ""
                : ` · ${source.label}`}
            </p>
            <div className="mt-1.5 flex h-2 items-end gap-0.5" aria-hidden>
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "w-1 rounded-sm bg-accent/60 transition-all duration-300",
                    isAudio && playing ? "animate-pulse" : "opacity-40",
                  )}
                  style={{
                    height: isAudio && playing ? `${4 + ((index * 7) % 9)}px` : "3px",
                    animationDelay: `${index * 90}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {isAudio && (
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink"
              aria-label={muted ? "Ativar som" : "Silenciar música"}
              title={muted ? "Ativar som" : "Silenciar"}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          )}
        </div>

        {source.kind === "spotify" && (
          <iframe
            src={source.embedUrl}
            title="Player do Spotify"
            className="mt-2 w-full rounded-lg"
            height={152}
            loading="lazy"
            allow={IFRAME_ALLOW}
          />
        )}

        {source.kind === "soundcloud" && (
          <iframe
            src={source.embedUrl}
            title="Player do SoundCloud"
            className="mt-2 w-full rounded-lg"
            height={120}
            loading="lazy"
            allow={IFRAME_ALLOW}
          />
        )}

        {needsClick &&
          (activated ? (
            <iframe
              src={source.autoplayUrl ?? source.embedUrl}
              title={`Player do ${source.label}`}
              className="mt-2 aspect-video w-full rounded-lg"
              loading="lazy"
              allow={IFRAME_ALLOW}
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setActivated(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-3 py-3 text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              <Play size={14} /> tocar no {source.label}
            </button>
          ))}
      </div>
    </div>
  );
}
