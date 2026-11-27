"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Música do perfil: tenta tocar assim que a página abre. Navegadores podem
 * bloquear áudio sem interação — nesse caso o botão de play fica em destaque.
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => setPlaying(true)).catch(() => setBlocked(true));
    }
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        setPlaying(true);
        setBlocked(false);
      }).catch(() => setBlocked(true));
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

  return (
    <div className="mt-3 flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface-2/70 p-2 pr-3">
      <audio ref={audioRef} src={url} loop preload="auto" />

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

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-xs font-semibold">
          <Music2 size={11} className="shrink-0 text-accent" />
          <span className="truncate">{title || "Música do perfil"}</span>
        </p>
        <p className="truncate text-[0.68rem] text-muted">
          {artist || "artista desconhecido"}
          {blocked ? " · toque no play para ouvir" : playing ? " · tocando" : ""}
        </p>
        <div className="mt-1.5 flex h-2 items-end gap-0.5" aria-hidden>
          {Array.from({ length: 16 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "w-1 rounded-sm bg-accent/60 transition-all duration-300",
                playing ? "animate-pulse" : "opacity-40",
              )}
              style={{
                height: playing ? `${4 + ((index * 7) % 9)}px` : "3px",
                animationDelay: `${index * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleMute}
        className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink"
        aria-label={muted ? "Ativar som" : "Silenciar música"}
        title={muted ? "Ativar som" : "Silenciar"}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>
    </div>
  );
}
