"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ImagePlus,
  Loader2,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPostAction } from "@/lib/actions/posts";
import { Avatar } from "@/components/avatar";
import { cn, fileExtension } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type CommunityOption = { id: string; name: string; slug: string };

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION = 10 * 60; // 10 minutos

/** Lê a duração do vídeo no navegador antes de enviar. */
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

type LocalMedia = {
  file: File;
  preview: string;
  kind: "image" | "gif" | "video";
};

export function Composer({
  profile,
  communities = [],
  defaultCommunityId,
  autoFocus = false,
  placeholder = "O que está acontecendo?",
  quickEmojis = [],
}: {
  profile: Profile;
  communities?: CommunityOption[];
  defaultCommunityId?: string;
  autoFocus?: boolean;
  placeholder?: string;
  quickEmojis?: string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [communityId, setCommunityId] = useState(defaultCommunityId ?? "");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [collabOpen, setCollabOpen] = useState(false);
  const [collaborators, setCollaborators] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = 2000 - content.length;
  const hasVideo = media.some((item) => item.kind === "video");
  const filledPoll = pollOptions.map((option) => option.trim()).filter(Boolean);
  const pollInvalid = pollOpen && filledPoll.length > 0 && filledPoll.length < 2;
  const canSubmit =
    (content.trim().length > 0 || media.length > 0 || filledPoll.length >= 2) &&
    remaining >= 0 &&
    !pollInvalid &&
    !pending;

  async function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    setError(null);
    const next = [...media];

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setError("Apenas imagens, GIFs e vídeos são aceitos.");
        continue;
      }

      if (isVideo) {
        if (next.some((item) => item.kind === "video")) {
          setError("Só um vídeo por publicação.");
          continue;
        }
        if (next.length >= MAX_IMAGES) {
          setError(`Máximo de ${MAX_IMAGES} mídias por publicação.`);
          continue;
        }
        if (file.size > MAX_VIDEO_SIZE) {
          setError("O vídeo pode ter até 50 MB (cerca de 10 minutos em qualidade média).");
          continue;
        }
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION) {
          setError("O vídeo pode ter no máximo 10 minutos.");
          continue;
        }
        next.push({ file, preview: URL.createObjectURL(file), kind: "video" });
        continue;
      }

      if (hasVideo || next.some((item) => item.kind === "video")) {
        setError("Vídeo e fotos não podem ser misturados na mesma publicação.");
        continue;
      }
      if (next.length >= MAX_IMAGES) {
        setError(`Máximo de ${MAX_IMAGES} imagens por publicação.`);
        break;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError("Cada imagem pode ter até 10 MB.");
        continue;
      }
      next.push({
        file,
        preview: URL.createObjectURL(file),
        kind: file.type === "image/gif" ? "gif" : "image",
      });
    }
    setMedia(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeMedia(index: number) {
    setMedia((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  function updatePoll(index: number, value: string) {
    setPollOptions((current) => current.map((item, i) => (i === index ? value : item)));
  }

  async function publish() {
    if (!canSubmit) return;
    setError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const uploaded: Array<{ path: string; url: string; type: string }> = [];

        for (const item of media) {
          const path = `${profile.id}/${crypto.randomUUID()}.${fileExtension(item.file)}`;
          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(path, item.file, {
              contentType: item.file.type,
              cacheControl: "31536000",
              upsert: false,
            });

          if (uploadError) {
            setError("Falha ao enviar a mídia. Tente novamente.");
            return;
          }

          const { data } = supabase.storage.from("post-media").getPublicUrl(path);
          uploaded.push({ path, url: data.publicUrl, type: item.kind });
        }

        const formData = new FormData();
        formData.set("content", content);
        formData.set("community_id", communityId);
        formData.set("media", JSON.stringify(uploaded));
        if (filledPoll.length >= 2) formData.set("poll", JSON.stringify(filledPoll));
        if (collaborators.trim()) formData.set("collaborators", collaborators.trim());

        const result = await createPostAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        media.forEach((item) => URL.revokeObjectURL(item.preview));
        setContent("");
        setMedia([]);
        setPollOpen(false);
        setPollOptions(["", ""]);
        setCollabOpen(false);
        setCollaborators("");
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
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData?.files ?? []);
              if (pasted.length > 0) {
                event.preventDefault();
                void addFiles(pasted);
              }
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={content.length > 120 ? 5 : 2}
            className="w-full resize-none border-0 bg-transparent py-1 text-[0.98rem] leading-relaxed outline-none placeholder:text-muted"
            aria-label="Texto da publicação"
          />

          {quickEmojis.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setContent((current) => `${current}${emoji}`)}
                  className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-sm hover:border-accent"
                  aria-label={`Inserir ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {media.length > 0 && (
            <div
              className={cn(
                "mb-2 grid gap-1.5",
                media.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {media.map((item, index) => (
                <div key={item.preview} className="relative overflow-hidden rounded-lg border border-line">
                  {item.kind === "video" ? (
                    <video
                      src={item.preview}
                      className="h-40 w-full bg-black object-contain"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.preview}
                      alt={`Mídia ${index + 1} selecionada`}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white hover:bg-black/85"
                    aria-label="Remover mídia"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pollOpen && (
            <div className="mb-2 space-y-1.5 rounded-xl border border-line bg-bg p-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                  <BarChart3 size={13} /> enquete
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPollOpen(false);
                    setPollOptions(["", ""]);
                  }}
                  className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label="Remover enquete"
                >
                  <X size={13} />
                </button>
              </div>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    value={option}
                    onChange={(event) => updatePoll(index, event.target.value)}
                    maxLength={60}
                    placeholder={`Opção ${index + 1}`}
                    className="field text-sm"
                    aria-label={`Opção ${index + 1} da enquete`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPollOptions((current) => current.filter((_, i) => i !== index))
                      }
                      className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                      aria-label={`Remover opção ${index + 1}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((current) => [...current, ""])}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus size={12} /> adicionar opção
                </button>
              )}
            </div>
          )}

          {collabOpen && (
            <div className="mb-2 rounded-xl border border-line bg-bg p-2.5">
              <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <Users size={13} /> publicar junto com
              </span>
              <input
                value={collaborators}
                onChange={(event) => setCollaborators(event.target.value)}
                maxLength={80}
                placeholder="@amigo, @outro"
                className="field text-sm"
                aria-label="Colaboradores da publicação"
              />
              <p className="mt-1 text-[0.68rem] text-muted">
                Até 3 pessoas. Use os nomes de usuário com @.
              </p>
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
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              multiple
              hidden
              onChange={(event) => void addFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending || media.length >= MAX_IMAGES}
              className="btn btn-quiet !rounded-lg !px-2 !py-1.5 text-accent"
              aria-label="Adicionar imagens ou vídeo"
              title="Imagem, GIF ou vídeo (até 10 min). Você também pode colar com Ctrl+V."
            >
              <ImagePlus size={18} />
            </button>

            <button
              type="button"
              onClick={() => setPollOpen((value) => !value)}
              aria-expanded={pollOpen}
              className={cn(
                "btn btn-quiet !rounded-lg !px-2 !py-1.5",
                pollOpen ? "text-accent" : "text-muted",
              )}
              aria-label="Adicionar enquete"
              title="Enquete"
            >
              <BarChart3 size={18} />
            </button>

            <button
              type="button"
              onClick={() => setCollabOpen((value) => !value)}
              aria-expanded={collabOpen}
              className={cn(
                "btn btn-quiet !rounded-lg !px-2 !py-1.5",
                collabOpen ? "text-accent" : "text-muted",
              )}
              aria-label="Adicionar colaboradores"
              title="Publicação colaborativa"
            >
              <Users size={18} />
            </button>

            {communities.length > 0 && (
              <select
                value={communityId}
                onChange={(event) => setCommunityId(event.target.value)}
                className="max-w-[38%] truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-muted"
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
                remaining < 0 ? "text-danger" : "text-muted",
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
