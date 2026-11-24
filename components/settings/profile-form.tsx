"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "@/lib/actions/profile";
import { fileExtension } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [website, setWebsite] = useState(profile.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(kind: "avatar" | "banner", file: File) {
    setError(null);
    setUploading(kind);
    const supabase = createClient();
    const bucket = kind === "avatar" ? "avatars" : "banners";
    const path = `${profile.id}/${kind}-${Date.now()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setError("Falha no upload da imagem.");
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (kind === "avatar") setAvatarUrl(data.publicUrl);
    else setBannerUrl(data.publicUrl);
    setUploading(null);
  }

  function save() {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("display_name", displayName);
    formData.set("username", username);
    formData.set("bio", bio);
    formData.set("website", website);
    formData.set("avatar_url", avatarUrl ?? "");
    formData.set("banner_url", bannerUrl ?? "");

    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? "Salvo.");
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ok">
          {success}
        </p>
      )}

      <div>
        <span className="field-label">Banner</span>
        <div className="relative h-28 overflow-hidden rounded-xl border border-line bg-surface-2">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="Banner atual" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">Sem banner</div>
          )}
          {uploading === "banner" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={18} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <input
          ref={bannerInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload("banner", file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => bannerInput.current?.click()}
          className="btn btn-quiet mt-2 !px-0 text-xs text-accent"
        >
          <ImagePlus size={13} /> Alterar banner
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-line bg-surface-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[0.65rem] text-muted">sem foto</div>
          )}
          {uploading === "avatar" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={14} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload("avatar", file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          className="btn btn-ghost !px-3 !py-1.5 text-xs"
        >
          <ImagePlus size={13} /> Trocar foto
        </button>
        <p className="text-xs text-muted">JPG, PNG, WEBP ou GIF.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="display_name">
            Nome
          </label>
          <input
            id="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={50}
            required
            className="field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="username">
            Nome de usuário
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) =>
              setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            maxLength={20}
            required
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="bio">
          Biografia
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={280}
          rows={3}
          className="field resize-none"
          placeholder="Conte em poucas palavras o que você faz e do que gosta."
        />
        <p className="mt-1 text-right text-[0.7rem] text-muted">{280 - bio.length}</p>
      </div>

      <div>
        <label className="field-label" htmlFor="website">
          Site
        </label>
        <input
          id="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          maxLength={120}
          className="field"
          placeholder="https://…"
        />
      </div>

      <button type="submit" disabled={pending || uploading !== null} className="btn btn-primary">
        {pending && <Loader2 size={14} className="animate-spin" />}
        Salvar perfil
      </button>
    </form>
  );
}
