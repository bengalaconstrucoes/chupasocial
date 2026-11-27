"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { setBackgroundTheme } from "@/components/background-fx";
import {
  BACKGROUND_COOKIE as COOKIE,
  BACKGROUND_IMAGE_COOKIE as IMAGE_COOKIE,
  BACKGROUND_THEMES,
  normalizeBackground,
  normalizeBackgroundImage,
  type BackgroundTheme,
} from "@/lib/background";
import { createClient } from "@/lib/supabase/client";
import { cn, fileExtension } from "@/lib/utils";

export function BackgroundPicker({ userId }: { userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<BackgroundTheme>("none");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCurrent(normalizeBackground(localStorage.getItem(COOKIE)));
      setImage(normalizeBackgroundImage(localStorage.getItem(IMAGE_COOKIE)));
    } catch {}
  }, []);

  function choose(theme: BackgroundTheme) {
    if (theme === "custom" && !image) {
      inputRef.current?.click();
      return;
    }
    setCurrent(theme);
    setBackgroundTheme(theme, image);
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem de fundo pode ter até 8 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/background-${Date.now()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: true });

    if (uploadError) {
      setError("Falha no upload da imagem.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    setImage(data.publicUrl);
    setCurrent("custom");
    setBackgroundTheme("custom", data.publicUrl);
    setUploading(false);
  }

  function clearImage() {
    setImage(null);
    setCurrent("none");
    setBackgroundTheme("none", null);
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn btn-ghost !px-3 !py-1.5 text-xs"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {uploading ? "Enviando" : image ? "Trocar imagem" : "Enviar imagem"}
        </button>
        {image && (
          <button
            type="button"
            onClick={clearImage}
            className="btn btn-quiet !px-2.5 !py-1.5 text-xs text-danger"
          >
            <Trash2 size={12} /> remover fundo
          </button>
        )}
      </div>

      {image && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Prévia do fundo escolhido" className="h-28 w-full object-cover" />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <p className="mt-2 text-[0.7rem] text-muted">
        O fundo fica salvo neste navegador e continua igual depois de recarregar a página.
      </p>
    </div>
  );
}
