"use client";

import { useEffect, useState } from "react";
import {
  BACKGROUND_COOKIE as COOKIE,
  BACKGROUND_IMAGE_COOKIE as IMAGE_COOKIE,
  backgroundLayerCss,
  isParticleTheme,
  normalizeBackground,
  normalizeBackgroundImage,
  type BackgroundTheme,
} from "@/lib/background";
import { cn } from "@/lib/utils";

type BackgroundState = { theme: BackgroundTheme; image: string | null };

export function setBackgroundTheme(theme: BackgroundTheme, imageUrl?: string | null) {
  const image = normalizeBackgroundImage(imageUrl);
  try {
    localStorage.setItem(COOKIE, theme);
    if (image) localStorage.setItem(IMAGE_COOKIE, image);
    else localStorage.removeItem(IMAGE_COOKIE);
  } catch {}
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document.cookie = image
    ? `${IMAGE_COOKIE}=${encodeURIComponent(image)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    : `${IMAGE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  window.dispatchEvent(
    new CustomEvent<BackgroundState>("chupa:bg", { detail: { theme, image } }),
  );
}

/** Posições determinísticas: SSR e cliente desenham o mesmo HTML. */
function seed(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function BackgroundFx({
  initial = "none",
  initialImage = null,
}: {
  initial?: BackgroundTheme;
  initialImage?: string | null;
}) {
  const [theme, setTheme] = useState<BackgroundTheme>(initial);
  const [image, setImage] = useState<string | null>(normalizeBackgroundImage(initialImage));

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE);
      if (stored) setTheme(normalizeBackground(stored));
      const storedImage = localStorage.getItem(IMAGE_COOKIE);
      if (storedImage) setImage(normalizeBackgroundImage(storedImage));
    } catch {}

    function onChange(event: Event) {
      const detail = (event as CustomEvent<BackgroundState | string>).detail;
      if (typeof detail === "string") {
        setTheme(normalizeBackground(detail));
        return;
      }
      setTheme(normalizeBackground(detail?.theme));
      setImage(normalizeBackgroundImage(detail?.image));
    }

    function onStorage(event: StorageEvent) {
      if (event.key === COOKIE) setTheme(normalizeBackground(event.newValue));
      if (event.key === IMAGE_COOKIE) setImage(normalizeBackgroundImage(event.newValue));
    }

    window.addEventListener("chupa:bg", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("chupa:bg", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const layer = backgroundLayerCss(theme, image);
  const particles = isParticleTheme(theme);

  if (!layer && !particles) return null;

  return (
    <>
      {layer && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={layer as React.CSSProperties}
        />
      )}

      {particles && (
        <div aria-hidden className={cn("chupa-fx", `chupa-fx-${theme}`)}>
          {Array.from({ length: theme === "stars" ? 46 : 22 }).map((_, index) => {
            const size = theme === "stars" ? 2 + seed(index, 3) * 2 : 4 + seed(index, 1) * 9;
            const duration =
              (theme === "stars" ? 3 : 12) + seed(index, 5) * (theme === "stars" ? 4 : 12);
            const style: React.CSSProperties = {
              left: `${seed(index, 2) * 100}%`,
              width: size,
              height: size,
              // Negativo: a partícula já começa no meio do ciclo, então aparece de imediato.
              animationDelay: `-${seed(index, 4) * duration}s`,
              animationDuration: `${duration}s`,
            };

            if (theme !== "stars") {
              style.bottom = `${-10 - seed(index, 6) * 20}%`;
              style.opacity =
                theme === "bubbles" ? 0.25 + seed(index, 7) * 0.3 : 0.5 + seed(index, 7) * 0.45;
            } else {
              style.top = `${seed(index, 8) * 100}%`;
            }

            return <span key={index} className="chupa-fx-dot" style={style} />;
          })}
        </div>
      )}
    </>
  );
}
