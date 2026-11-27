"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { setBackgroundTheme } from "@/components/background-fx";
import {
  BACKGROUND_COOKIE as COOKIE,
  BACKGROUND_THEMES,
  normalizeBackground,
  type BackgroundTheme,
} from "@/lib/background";
import { cn } from "@/lib/utils";

export function BackgroundPicker() {
  const [current, setCurrent] = useState<BackgroundTheme>("none");

  useEffect(() => {
    try {
      setCurrent(normalizeBackground(localStorage.getItem(COOKIE)));
    } catch {}
  }, []);

  function choose(theme: BackgroundTheme) {
    setCurrent(theme);
    setBackgroundTheme(theme);
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {BACKGROUND_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => choose(theme.id)}
            aria-pressed={current === theme.id}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
              current === theme.id
                ? "border-accent bg-accent-soft"
                : "border-line hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                current === theme.id
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-transparent",
              )}
              aria-hidden
            >
              <Check size={12} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{theme.label}</span>
              <span className="block text-xs text-muted">{theme.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.7rem] text-muted">
        O tema de fundo fica salvo e continua igual depois de recarregar a página.
      </p>
    </div>
  );
}
