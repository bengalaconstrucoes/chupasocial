"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createStoryAction, deleteStoryAction } from "@/lib/actions/stories";
import { Avatar } from "@/components/avatar";
import { cn, fileExtension } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type { StoryGroup } from "@/lib/queries";

const SEEN_KEY = "chupa:stories:seen";
const MAX_BYTES = 24 * 1024 * 1024;
const IMAGE_DURATION = 6000;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.slice(-600) : []);
  } catch {
    return new Set();
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

export function StoryTray({
  groups,
  viewer,
}: {
  groups: StoryGroup[];
  viewer: Profile;
}) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const markSeen = useCallback((ids: string[]) => {
    setSeen((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-600)));
      } catch {}
      return next;
    });
  }, []);

  const ownIndex = groups.findIndex((group) => group.author.id === viewer.id);
  const ordered = ownIndex > 0 ? [
    groups[ownIndex],
    ...groups.slice(0, ownIndex),
    ...groups.slice(ownIndex + 1),
  ] : groups;

  return (
    <section
      className="border-b border-line bg-surface px-3 py-2.5 sm:px-4"
      aria-label="Stories"
    >
      <ul className="flex items-start gap-3 overflow-x-auto pb-0.5">
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => {
              const index = ordered.findIndex((group) => group.author.id === viewer.id);
              if (index >= 0) setOpenIndex(index);
              else setComposerOpen(true);
            }}
            className="flex w-16 flex-col items-center gap-1 text-center"
            aria-label="Seu story"
          >
            <span className="relative">
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border p-0.5",
                  ownIndex >= 0 ? "border-accent" : "border-dashed border-line",
                )}
              >
                <Avatar profile={viewer} size={48} link={false} />
              </span>
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-ink"
                aria-hidden
              >
                <Plus size={12} />
              </span>
            </span>
            <span className="w-full truncate text-[0.62rem] text-muted">Seu story</span>
          </button>
        </li>

        {ordered
          .filter((group) => group.author.id !== viewer.id)
          .map((group) => {
            const unseen = group.stories.some((story) => !seen.has(story.id));
            const index = ordered.indexOf(group);
            return (
              <li key={group.author.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  className="flex w-16 flex-col items-center gap-1 text-center"
                  title={group.author.display_name || group.author.username}
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full p-0.5",
                      unseen
                        ? "bg-gradient-to-tr from-accent via-fuchsia-500 to-amber-400"
                        : "bg-line",
                    )}
                  >
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface">
                      <Avatar profile={group.author} size={48} link={false} />
                    </span>
                  </span>
                  <span className="w-full truncate text-[0.62rem] text-muted">
                    {group.author.display_name?.split(" ")[0] || group.author.username}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>

      {composerOpen && (
        <StoryComposer
          userId={viewer.id}
          onClose={() => setComposerOpen(false)}
        />
      )}

      {openIndex !== null && ordered[openIndex] && (
        <StoryViewer
          groups={ordered}
          startIndex={openIndex}
          viewerId={viewer.id}
          onSeen={markSeen}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </section>
  );
}

function StoryComposer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function choose(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    const isVideo = picked.type.startsWith("video/");
    if (!isVideo && !picked.type.startsWith("image/")) {
      setError("Escolha uma imagem ou um vídeo.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("O arquivo precisa ter até 24 MB.");
      return;
    }
    setError(null);
    setKind(isVideo ? "video" : "image");
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  function publish() {
    if (!file) {
      setError("Escolha uma foto ou um vídeo primeiro.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const path = `${userId}/${crypto.randomUUID()}.${fileExtension(file)}`;
        const { error: uploadError } = await supabase.storage
          .from("stories")
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          setError("Falha ao enviar o story. Tente novamente.");
          return;
        }

        const { data } = supabase.storage.from("stories").getPublicUrl(path);
        const result = await createStoryAction(data.publicUrl, kind, caption);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        onClose();
        router.refresh();
      } catch {
        setError("Erro inesperado ao publicar o story.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Criar story"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Novo story</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => choose(event.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2 text-muted hover:text-accent"
        >
          {preview ? (
            kind === "video" ? (
              <video src={preview} className="h-full w-full object-cover" muted playsInline controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Prévia do story" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-xs">
              <ImagePlus size={22} />
              Escolher foto ou vídeo
            </span>
          )}
        </button>

        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value.slice(0, 140))}
          placeholder="Legenda (opcional)"
          maxLength={140}
          className="mt-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[0.68rem] text-muted">Some em 24 horas.</span>
          <button
            type="button"
            onClick={publish}
            disabled={pending || !file}
            className="btn btn-primary text-sm"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StoryViewer({
  groups,
  startIndex,
  viewerId,
  onSeen,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  viewerId: string;
  onSeen: (ids: string[]) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = group?.author.id === viewerId;

  const goNext = useCallback(() => {
    const current = groups[groupIndex];
    if (!current) {
      onClose();
      return;
    }
    if (storyIndex + 1 < current.stories.length) {
      setStoryIndex(storyIndex + 1);
      return;
    }
    const nextGroup = groups[groupIndex + 1];
    if (nextGroup) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      return;
    }
    onClose();
  }, [groupIndex, groups, onClose, storyIndex]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }
    const previous = groups[groupIndex - 1];
    if (previous) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, previous.stories.length - 1));
      return;
    }
    setProgress(0);
  }, [groupIndex, groups, storyIndex]);

  const storyId = story?.id;

  useEffect(() => {
    setProgress(0);
    setVideoDuration(0);
  }, [storyId]);

  useEffect(() => {
    if (!storyId) return;
    onSeen([storyId]);
  }, [storyId, onSeen]);

  useEffect(() => {
    if (!story || paused) return;
    const total = story.media_type === "video" ? videoDuration * 1000 : IMAGE_DURATION;
    if (!total) return;
    const step = 50;
    const id = window.setInterval(() => {
      setProgress((value) => value + (step / total) * 100);
    }, step);
    return () => window.clearInterval(id);
  }, [story, paused, videoDuration, storyId]);

  useEffect(() => {
    if (progress >= 100) goNext();
  }, [progress, goNext]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [goNext, goPrev, onClose]);

  async function remove() {
    if (!story || deleting) return;
    setDeleting(true);
    const result = await deleteStoryAction(story.id);
    setDeleting(false);
    if (result.ok) {
      onClose();
      router.refresh();
    }
  }

  if (!group || !story) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${group.author.username}`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-md flex-col">
        <div className="flex gap-1 px-2 pt-2">
          {group.stories.map((item, index) => (
            <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white transition-[width] duration-100 ease-linear"
                style={{
                  width:
                    index < storyIndex
                      ? "100%"
                      : index === storyIndex
                        ? `${Math.min(100, Math.max(0, progress))}%`
                        : "0%",
                }}
              />
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 text-white">
          <Avatar profile={group.author} size={30} />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{group.author.display_name}</p>
            <p className="text-[0.65rem] text-white/60">{timeAgo(story.created_at)}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {isOwn && (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="rounded-full p-2 text-white/80 hover:bg-white/15"
                aria-label="Apagar story"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/80 hover:bg-white/15"
              aria-label="Fechar story"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          {story.media_type === "video" ? (
            <video
              key={story.id}
              src={story.media_url}
              autoPlay
              playsInline
              muted={false}
              onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration || 0)}
              onEnded={goNext}
              className="max-h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={story.id}
              src={story.media_url}
              alt={story.caption || `Story de ${group.author.username}`}
              className="max-h-full w-full object-contain"
            />
          )}

          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-0 h-full w-1/4 focus:outline-none"
            aria-label="Story anterior"
          />
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-0 h-full w-1/4 focus:outline-none"
            aria-label="Próximo story"
          />

          <button
            type="button"
            onClick={goPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/60"
            aria-label="Story anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/60"
            aria-label="Próximo story"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {story.caption && (
          <p className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-8 text-sm text-white">
            {story.caption}
          </p>
        )}
      </div>
    </div>
  );
}
