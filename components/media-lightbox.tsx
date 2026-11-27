"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostMedia } from "@/lib/types";

/**
 * Grade de mídia com visualizador embutido: a imagem abre ampliada por cima da
 * página, com zoom, navegação e atalhos de teclado. Sem abrir outra aba.
 */
export function PostMediaGrid({
  media,
  authorName,
}: {
  media: PostMedia[];
  authorName: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  const photos = media.filter((item) => item.media_type !== "video");
  const isOpen = openIndex !== null;
  const current = isOpen ? photos[openIndex] : null;

  const close = useCallback(() => {
    setOpenIndex(null);
    setZoom(1);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setZoom(1);
      setOpenIndex((index) => {
        if (index === null) return index;
        return (index + delta + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (!isOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, close, step]);

  if (media.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "mt-3 grid gap-1 overflow-hidden rounded-xl border border-line",
          media.length === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {media.map((item, index) => {
          if (item.media_type === "video") {
            return (
              <div
                key={item.id}
                className={cn(
                  "relative overflow-hidden bg-black",
                  media.length === 1 && "col-span-2",
                )}
              >
                <video
                  src={item.public_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[520px] w-full bg-black object-contain"
                />
              </div>
            );
          }

          const photoIndex = photos.findIndex((photo) => photo.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpenIndex(photoIndex);
                setZoom(1);
              }}
              className={cn(
                "group relative block cursor-zoom-in bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                media.length === 3 && index === 0 && "col-span-2",
              )}
              aria-label={`Ampliar imagem ${photoIndex + 1} de ${photos.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.public_url}
                alt={`Imagem ${photoIndex + 1} da publicação de ${authorName}`}
                loading="lazy"
                className={cn(
                  "w-full object-cover transition-opacity group-hover:opacity-95",
                  media.length === 1 ? "max-h-[520px]" : "h-56",
                )}
              />
              <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ZoomIn size={13} />
              </span>
            </button>
          );
        })}
      </div>

      {isOpen && current && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de imagem"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
            <span className="text-xs text-white/70">
              {photos.length > 1 ? `${openIndex! + 1} / ${photos.length}` : "Imagem"}
            </span>
            <div className="flex items-center gap-1">
              <a
                href={current.public_url}
                download
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full p-2 hover:bg-white/15"
                aria-label="Abrir imagem em tamanho original"
              >
                <Download size={17} />
              </a>
              <button
                type="button"
                onClick={close}
                ref={closeRef}
                className="rounded-full p-2 hover:bg-white/15"
                aria-label="Fechar imagem"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-20"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.public_url}
              alt={`Imagem ${openIndex! + 1} da publicação de ${authorName}`}
              className="max-h-full max-w-full rounded-lg object-contain transition-transform duration-150"
              style={{ transform: `scale(${zoom})` }}
            />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-4">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
              disabled={zoom <= 1}
              className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-40"
              aria-label="Diminuir zoom"
            >
              <ZoomOut size={17} />
            </button>
            <span className="w-10 text-center text-xs tabular-nums text-white/80">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))}
              disabled={zoom >= 4}
              className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-40"
              aria-label="Aumentar zoom"
            >
              <ZoomIn size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
