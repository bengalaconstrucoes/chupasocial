"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, Star, X } from "lucide-react";
import {
  fetchFavoriteGifsAction,
  searchGifsAction,
  toggleFavoriteGifAction,
} from "@/lib/actions/gifs";
import { cn } from "@/lib/utils";
import type { GifItem } from "@/lib/types";

export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GifItem) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"search" | "favorites">("search");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [favorites, setFavorites] = useState<GifItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void (async () => {
      const items = await fetchFavoriteGifsAction();
      if (!active) return;
      setFavorites(items);
      setFavoriteIds(new Set(items.map((item) => item.id)));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (tab !== "search") return;
    let active = true;
    setLoading(true);
    setError(null);

    const timer = setTimeout(
      async () => {
        const result = await searchGifsAction(query);
        if (!active) return;
        if (result.ok) {
          setGifs(result.gifs);
        } else {
          setGifs([]);
          setError(result.error);
        }
        setLoading(false);
      },
      query ? 420 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, tab]);

  function toggleFavorite(gif: GifItem) {
    const isFavorite = favoriteIds.has(gif.id);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(gif.id);
      else next.add(gif.id);
      return next;
    });
    setFavorites((current) =>
      isFavorite ? current.filter((item) => item.id !== gif.id) : [gif, ...current],
    );

    startTransition(async () => {
      const result = await toggleFavoriteGifAction(gif);
      if (!result.ok) {
        setFavoriteIds((current) => {
          const next = new Set(current);
          if (isFavorite) next.add(gif.id);
          else next.delete(gif.id);
          return next;
        });
        setNotice(result.error);
        return;
      }
      setNotice(result.message ?? null);
      setTimeout(() => setNotice(null), 1600);
    });
  }

  const list = tab === "search" ? gifs : favorites;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={cn(
              "rounded-md px-2 py-1 font-medium",
              tab === "search" ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={() => setTab("favorites")}
            className={cn(
              "rounded-md px-2 py-1 font-medium",
              tab === "favorites" ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            Favoritos
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Fechar GIFs"
        >
          <X size={15} />
        </button>
      </div>

      {tab === "search" && (
        <div className="relative px-2.5 py-2">
          <Search size={14} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar no Giphy"
            className="field !py-1.5 pl-8 text-xs"
            aria-label="Buscar GIF"
            autoFocus
          />
        </div>
      )}

      <div className="max-h-64 overflow-y-auto px-2.5 pb-2.5">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted">
            {tab === "favorites"
              ? "Nenhum GIF favoritado ainda. Toque na estrela para guardar."
              : error ?? "Nenhum GIF encontrado."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {list.map((gif) => (
              <div key={`${gif.provider}-${gif.id}`} className="group relative">
                <button
                  type="button"
                  onClick={() => onPick(gif)}
                  className="block w-full overflow-hidden rounded-md bg-surface-2 focus-visible:ring-2"
                  title={gif.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(gif)}
                  className={cn(
                    "absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition-opacity",
                    favoriteIds.has(gif.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label={
                    favoriteIds.has(gif.id) ? "Remover dos favoritos" : "Favoritar GIF"
                  }
                >
                  <Star size={12} className={favoriteIds.has(gif.id) ? "fill-current" : ""} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="border-t border-line px-2.5 py-1.5 text-[0.62rem] text-muted">
        {notice ?? (pending ? "Salvando favorito…" : "GIFs via Giphy")}
      </p>
    </div>
  );
}
