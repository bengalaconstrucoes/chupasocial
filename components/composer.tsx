"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPostAction } from "@/lib/actions/posts";
import { Avatar } from "@/components/avatar";
import { cn, fileExtension } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type CommunityOption = { id: string; name: string; slug: string };

const MAX_IMAGES = 4;
const MAX_SIZE = 10 * 1024 * 1024;

export function Composer({
  profile,
  communities = [],
  defaultCommunityId,
  autoFocus = false,
  placeholder = "O que está acontecendo?",
}: {
  profile: Profile;
  communities?: CommunityOption[];
  defaultCommunityId?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [communityId, setCommunityId] = useState(defaultCommunityId ?? "");
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = 2000 - content.length;
  const canSubmit = (content.trim().length > 0 || images.length > 0) && remaining >= 0 && !pending;

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) {
        setError(`Máximo de ${MAX_IMAGES} imagens por publicação.`);
        break;
      }
      if (!file.type.startsWith("image/")) {
        setError("Apenas imagens são aceitas.");
        continue;
      }
      if (file.size > MAX_SIZE) {
        setError("Cada imagem pode ter até 10 MB.");
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  async function publish() {
    if (!canSubmit) return;
    setError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const uploaded: Array<{ path: string; url: string }> = [];

        for (const image of images) {
          const path = `${profile.id}/${crypto.randomUUID()}.${fileExtension(image.file)}`;
          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(path, image.file, {
              contentType: image.file.type,
              cacheControl: "31536000",
              upsert: false,
            });

          if (uploadError) {
            setError("Falha ao enviar a imagem. Tente novamente.");
            return;
          }

          const { data } = supabase.storage.from("post-media").getPublicUrl(path);
          uploaded.push({ path, url: data.publicUrl });
        }

        const formData = new FormData();
        formData.set("content", content);
        formData.set("community_id", communityId);
        formData.set("media", JSON.stringify(uploaded));

        const result = await createPostAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        images.forEach((image) => URL.revokeObjectURL(image.preview));
        setContent("");
        setImages([]);
        setFeedback("Publicado!");
        router.refresh();
      } catch {
        setError("Erro inesperado ao publicar. Tente novamente.");
      }
    });
  }

  return (
    <section className="border-b border-line bg-surface px-4 py-3.5 sm:px-5" aria-label="Criar publicação">
      <div className="flex gap-3">
        <Avatar profile={profile} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={content.length > 120 ? 5 : 2}
            className="w-full resize-none border-0 bg-transparent py-1 text-[0.98rem] leading-relaxed outline-none placeholder:text-muted"
            aria-label="Texto da publicação"
          />

          {images.length > 0 && (
            <div
              className={cn(
                "mb-2 grid gap-1.5",
                images.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {images.map((image, index) => (
                <div key={image.preview} className="relative overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.preview}
                    alt={`Imagem ${index + 1} selecionada`}
                    className="h-40 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white hover:bg-black/85"
                    aria-label="Remover imagem"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(error || feedback) && (
            <p
              role={error ? "alert" : "status"}
              className={cn("mb-2 text-xs", error ? "text-danger" : "text-ok")}
            >
              {error ?? feedback}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              onChange={(event) => addFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending || images.length >= MAX_IMAGES}
              className="btn btn-quiet !rounded-lg !px-2 !py-1.5 text-accent"
              aria-label="Adicionar imagens"
            >
              <ImagePlus size={18} />
            </button>

            {communities.length > 0 && (
              <select
                value={communityId}
                onChange={(event) => setCommunityId(event.target.value)}
                className="max-w-[42%] truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-muted"
                aria-label="Publicar em uma comunidade"
              >
                <option value="">No meu perfil</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            )}

            <span
              className={cn(
                "ml-auto text-xs tabular-nums",
                remaining < 0 ? "text-danger" : remaining < 100 ? "text-muted" : "text-muted/70",
              )}
              aria-live="polite"
            >
              {remaining}
            </span>

            <button
              type="button"
              onClick={publish}
              disabled={!canSubmit}
              className="btn btn-primary !px-4 !py-2"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {pending ? "Publicando" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
