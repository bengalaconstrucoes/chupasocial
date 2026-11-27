"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createAlbumPhotoAction, deleteAlbumPhotoAction } from "@/lib/actions/album";
import { cn, fileExtension } from "@/lib/utils";
import type { AlbumPhoto } from "@/lib/queries";

const MAX_BYTES = 10 * 1024 * 1024;

export function ProfileAlbum({
  userId,
  photos,
  isOwner,
  username,
}: {
  userId: string;
  photos: AlbumPhoto[];
  isOwner: boolean;
  username: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = photos.find((photo) => photo.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Envie apenas imagens.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("A imagem precisa ter até 10 MB.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const path = `${userId}/album/${crypto.randomUUID()}.${fileExtension(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError("Falha ao enviar a foto.");
        return;
      }

      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      const result = await createAlbumPhotoAction(data.publicUrl, "");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(photo: AlbumPhoto) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAlbumPhotoAction(photo.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpenId(null);
      router.refresh();
    });
  }

  if (photos.length === 0 && !isOwner) return null;

  return (
    <section className="border-b border-line bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Álbum</h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending || photos.length >= 24}
            className="btn btn-ghost !px-3 !py-1 text-xs"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={13} />}
            adicionar foto
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          upload(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {photos.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          O álbum de @{username} ainda está vazio. Fotos do dia a dia, viagens, qualquer coisa.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenId(photo.id)}
                className="block aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-2"
                aria-label={photo.caption || "Abrir foto do álbum"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photo_url}
                  alt={photo.caption || "Foto do álbum"}
                  className="h-full w-full object-cover transition-opacity hover:opacity-90"
                  loading="lazy"
                />
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  disabled={pending}
                  className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white hover:bg-black/75"
                  aria-label="Remover foto"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Foto do álbum"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenId(null);
          }}
        >
          <div className="relative max-h-full max-w-3xl">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="absolute -top-9 right-0 rounded-full p-2 text-white hover:bg-white/15"
              aria-label="Fechar foto"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.photo_url}
              alt={current.caption || "Foto do álbum"}
              className={cn("max-h-[80vh] w-auto rounded-lg object-contain")}
            />
            {current.caption && (
              <p className="mt-2 text-center text-sm text-white/80">{current.caption}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
