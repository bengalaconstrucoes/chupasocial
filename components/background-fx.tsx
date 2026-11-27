"use client";

import { useEffect, useState } from "react";
import {
  BACKGROUND_COOKIE as COOKIE,
  normalizeBackground,
  type BackgroundTheme,
} from "@/lib/background";
import { cn } from "@/lib/utils";

export function setBackgroundTheme(theme: BackgroundTheme) {
  try {
    localStorage.setItem(COOKIE, theme);
  } catch {}
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.dispatchEvent(new CustomEvent<BackgroundTheme>("chupa:bg", { detail: theme }));
}

/** Posições determinísticas: SSR e cliente desenham o mesmo HTML. */
function seed(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function BackgroundFx({ initial = "none" }: { initial?: BackgroundTheme }) {
  const [theme, setTheme] = useState<BackgroundTheme>(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE);
      if (stored) setTheme(normalizeBackground(stored));
    } catch {}

    function onChange(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setTheme(normalizeBackground(detail));
    }

    window.addEventListener("chupa:bg", onChange);
    return () => window.removeEventListener("chupa:bg", onChange);
  }, []);

  if (theme === "none") return null;

  const count = theme === "stars" ? 46 : 22;

  return (
    <div aria-hidden className={cn("chupa-fx", `chupa-fx-${theme}`)}>
      {Array.from({ length: count }).map((_, index) => {
        const size = theme === "stars" ? 2 + seed(index, 3) * 2 : 4 + seed(index, 1) * 9;
        const duration = (theme === "stars" ? 3 : 12) + seed(index, 5) * (theme === "stars" ? 4 : 12);
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
          style.opacity = theme === "bubbles" ? 0.25 + seed(index, 7) * 0.3 : 0.5 + seed(index, 7) * 0.45;
        } else {
          style.top = `${seed(index, 8) * 100}%`;
        }

        return <span key={index} className="chupa-fx-dot" style={style} />;
      })}
    </div>
  );
}
