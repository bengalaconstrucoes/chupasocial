"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCommunityAction, updateCommunityAction } from "@/lib/actions/communities";
import { fileExtension, slugify } from "@/lib/utils";
import type { Community } from "@/lib/types";

export function CommunityForm({
  mode,
  community,
  userId,
}: {
  mode: "create" | "edit";
  community?: Community;
  userId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(community?.name ?? "");
  const [slug, setSlug] = useState(community?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(community?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(community?.image_url ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(community?.banner_url ?? null);
  const [bannerFocus, setBannerFocus] = useState(community?.banner_focus ?? 50);
  const [uploading, setUploading] = useState<"image" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File, kind: "image" | "banner") {
    setUploading(kind);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/${kind}-${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("community-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError("Não foi possível enviar a imagem.");
      setUploading(null);
      return;
    }
    const { data } = supabase.storage.from("community-images").getPublicUrl(path);
    if (kind === "banner") setBannerUrl(data.publicUrl);
    else setImageUrl(data.publicUrl);
    setUploading(null);
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    if (imageUrl) formData.set("image_url", imageUrl);
    if (bannerUrl) formData.set("banner_url", bannerUrl);
    formData.set("banner_focus", String(bannerFocus));
    if (mode === "create") formData.set("slug", slug || slugify(name));
    else if (community) formData.set("community_id", community.id);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCommunityAction(formData)
          : await updateCommunityAction(formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Imagem da comunidade" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-muted" />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={16} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file, "image");
              event.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
              className="btn btn-ghost !px-3 !py-1.5 text-xs"
            >
              {imageUrl ? "Trocar imagem" : "Enviar imagem"}
            </button>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="btn btn-quiet !px-2 !py-1.5 text-xs"
              >
                <X size={12} /> remover
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">PNG, JPG, WEBP ou GIF (até 4 MB).</p>
        </div>
      </div>

      <div>
        <span className="field-label">Banner da comunidade</span>
        <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-surface-2">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Banner da comunidade"
              className="h-full w-full object-cover"
              style={{ objectPosition: `50% ${bannerFocus}%` }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Sem banner
            </div>
          )}
          {uploading === "banner" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={16} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <input
          ref={bannerRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file, "banner");
            event.target.value = "";
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            disabled={uploading !== null}
            className="btn btn-ghost !px-3 !py-1.5 text-xs"
          >
            {bannerUrl ? "Trocar banner" : "Enviar banner"}
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => setBannerUrl(null)}
              className="btn btn-quiet !px-2 !py-1.5 text-xs"
            >
              <X size={12} /> remover
            </button>
          )}
        </div>
        {bannerUrl && (
          <div className="mt-2">
            <label className="field-label" htmlFor="community-banner-focus">
              Enquadramento
            </label>
            <input
              id="community-banner-focus"
              type="range"
              min={0}
              max={100}
              value={bannerFocus}
              onChange={(event) => setBannerFocus(Number(event.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor="community-name">
          Nome
        </label>
        <input
          id="community-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          maxLength={60}
          required
          className="field"
          placeholder="Ex.: Cozinha de Fundo"
        />
      </div>

      {mode === "create" && (
        <div>
          <label className="field-label" htmlFor="community-slug">
            Endereço
          </label>
          <div className="flex items-center gap-1 rounded-[10px] border border-line bg-surface px-2.5">
            <span className="text-sm text-muted">/communities/</span>
            <input
              id="community-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              required
              minLength={3}
              maxLength={32}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="community-description">
          Descrição
        </label>
        <textarea
          id="community-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          rows={4}
          className="field resize-none"
          placeholder="Sobre o que é esta comunidade? Quem deve entrar?"
        />
        <p className="mt-1 text-right text-[0.7rem] text-muted">{500 - description.length}</p>
      </div>

      <button type="submit" disabled={pending || uploading !== null} className="btn btn-primary">
        {pending && <Loader2 size={14} className="animate-spin" />}
        {mode === "create" ? "Criar comunidade" : "Salvar alterações"}
      </button>
    </form>
  );
}
