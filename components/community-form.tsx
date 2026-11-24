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
  const [name, setName] = useState(community?.name ?? "");
  const [slug, setSlug] = useState(community?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(community?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(community?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("community-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError("Não foi possível enviar a imagem.");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("community-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    if (imageUrl) formData.set("image_url", imageUrl);
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
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
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

      <button type="submit" disabled={pending || uploading} className="btn btn-primary">
        {pending && <Loader2 size={14} className="animate-spin" />}
        {mode === "create" ? "Criar comunidade" : "Salvar alterações"}
      </button>
    </form>
  );
}
