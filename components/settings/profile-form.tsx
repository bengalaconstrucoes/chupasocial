"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, MapPin, Music2, Sparkles, Trash2 } from "lucide-react";
import { FLAG_GROUPS, flagsByGroup } from "@/lib/flags";
import { AVATAR_FRAMES, normalizeAvatarFrame } from "@/lib/avatar-frames";
import { Avatar } from "@/components/avatar";
import { FlagBadge } from "@/components/badges";
import { AvatarCrop } from "@/components/settings/avatar-crop";
import { GifPicker } from "@/components/gif-picker";
import { parseMusicUrl } from "@/lib/music";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "@/lib/actions/profile";
import {
  ACCENT_COLORS,
  NAME_FONTS,
  normalizeAccent,
  profileAccentStyle,
} from "@/lib/profile-style";
import { cn, fileExtension } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [website, setWebsite] = useState(profile.website ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [accentColor, setAccentColor] = useState<string | null>(
    normalizeAccent(profile.accent_color),
  );
  const [nameFont, setNameFont] = useState(profile.name_font || "default");
  const [flag, setFlag] = useState(profile.flag ?? "");
  const [statusEmoji, setStatusEmoji] = useState(profile.status_emoji ?? "");
  const [statusText, setStatusText] = useState(profile.status_text ?? "");
  const [favoriteSong, setFavoriteSong] = useState(profile.favorite_song ?? "");
  const [favoriteSongArtist, setFavoriteSongArtist] = useState(
    profile.favorite_song_artist ?? "",
  );
  const [songUrl, setSongUrl] = useState(profile.song_url ?? "");
  const [avatarFrame, setAvatarFrame] = useState(normalizeAvatarFrame(profile.avatar_frame));
  const [profileStyle, setProfileStyle] = useState<string>(profile.profile_style ?? "modern");
  const [showStats, setShowStats] = useState(profile.show_stats);
  const [showVisits, setShowVisits] = useState(profile.show_visits);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url);
  const [uploading, setUploading] = useState<"avatar" | "banner" | "song" | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewNameFont = NAME_FONTS.find((font) => font.id === nameFont)?.className ?? "";
  const musicSource = parseMusicUrl(songUrl);
  const previewProfile = {
    ...profile,
    display_name: displayName || profile.display_name,
    username,
    avatar_frame: avatarFrame,
  };

  async function upload(kind: "banner", file: File) {
    setError(null);
    setUploading(kind);
    const supabase = createClient();
    const path = `${profile.id}/${kind}-${Date.now()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setError("Falha no upload da imagem.");
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    setBannerUrl(data.publicUrl);
    setUploading(null);
  }

  async function uploadAvatarBlob(blob: Blob, contentType: string, extension: string) {
    setUploading("avatar");
    setError(null);
    const supabase = createClient();
    const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType, cacheControl: "3600", upsert: true });

    if (uploadError) {
      setError(
        contentType === "image/gif"
          ? "Falha no upload do GIF. Use um arquivo de até 5 MB."
          : "Falha no upload da foto.",
      );
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(null);
    setCropFile(null);
  }

  function uploadAvatar(blob: Blob) {
    return uploadAvatarBlob(blob, "image/jpeg", "jpg");
  }

  async function uploadSong(file: File) {
    if (!file.type.startsWith("audio/")) {
      setError("Escolha um arquivo de áudio (MP3, M4A, OGG…).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("A música pode ter até 15 MB.");
      return;
    }

    setUploading("song");
    setError(null);
    const supabase = createClient();
    const path = `${profile.id}/song-${Date.now()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("songs")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: true });

    if (uploadError) {
      setError("Falha no upload da música. Confira o formato e o tamanho.");
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("songs").getPublicUrl(path);
    setSongUrl(data.publicUrl);
    setUploading(null);
  }

  function useGifAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("O GIF da foto pode ter até 5 MB.");
      return;
    }
    void uploadAvatarBlob(file, "image/gif", "gif");
  }

  function save() {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("display_name", displayName);
    formData.set("username", username);
    formData.set("bio", bio);
    formData.set("website", website);
    formData.set("location", location);
    formData.set("accent_color", accentColor ?? "");
    formData.set("name_font", nameFont);
    formData.set("avatar_url", avatarUrl ?? "");
    formData.set("banner_url", bannerUrl ?? "");
    formData.set("flag", flag);
    formData.set("status_emoji", statusEmoji);
    formData.set("status_text", statusText);
    formData.set("favorite_song", favoriteSong);
    formData.set("favorite_song_artist", favoriteSongArtist);
    formData.set("song_url", songUrl);
    formData.set("avatar_frame", avatarFrame);
    formData.set("profile_style", profileStyle);
    if (showStats) formData.set("show_stats", "on");
    if (showVisits) formData.set("show_visits", "on");

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
      className="space-y-5"
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

      <div className="flex flex-wrap items-center gap-3">
        <Avatar profile={previewProfile} size={64} link={false} />
        <div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                // GIF animado não passa pelo recorte (o canvas mataria a animação).
                if (file.type === "image/gif") useGifAvatar(file);
                else setCropFile(file);
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            className="btn btn-ghost !px-3 !py-1.5 text-xs"
          >
            {uploading === "avatar" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ImagePlus size={13} />
            )}
            {uploading === "avatar" ? "Enviando" : "Trocar foto"}
          </button>
          <div className="relative mt-1.5">
            <button
              type="button"
              onClick={() => setGifOpen((value) => !value)}
              aria-expanded={gifOpen}
              className="btn btn-quiet !px-2.5 !py-1 text-xs text-accent"
            >
              <Sparkles size={12} /> Usar GIF animado
            </button>
            {gifOpen && (
              <GifPicker
                onPick={(gif) => {
                  setAvatarUrl(gif.url);
                  setGifOpen(false);
                }}
                onClose={() => setGifOpen(false)}
              />
            )}
          </div>
          <p className="mt-1 text-[0.7rem] text-muted">
            Você ajusta o zoom e o recorte antes de salvar. GIFs animados entram inteiros.
          </p>
        </div>
      </div>

      <div>
        <span className="field-label">Moldura da foto</span>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_FRAMES.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => setAvatarFrame(frame.id)}
              aria-pressed={avatarFrame === frame.id}
              title={frame.hint}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs",
                avatarFrame === frame.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {frame.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[0.7rem] text-muted">
          A moldura aparece na sua foto em todo o site.
        </p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="status_text">
            Status personalizado
          </label>
          <input
            id="status_text"
            value={statusText}
            onChange={(event) => setStatusText(event.target.value)}
            maxLength={80}
            className="field"
            placeholder="ouvindo música, estudando…"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="status_emoji">
            Emoji do status
          </label>
          <input
            id="status_emoji"
            value={statusEmoji}
            onChange={(event) => setStatusEmoji(event.target.value)}
            maxLength={8}
            className="field"
            placeholder="🎧"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="flag">
          Bandeira do perfil
        </label>
        {flag && (
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            <FlagBadge flagId={flag} size={15} /> prévia da bandeira escolhida
          </p>
        )}
        <select
          id="flag"
          value={flag}
          onChange={(event) => setFlag(event.target.value)}
          className="field"
        >
          <option value="">Sem bandeira</option>
          {FLAG_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {flagsByGroup(group.id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.era ? ` · ${item.era}` : item.group === "estados" ? ` (${item.code})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="favorite_song">
            Música favorita
          </label>
          <input
            id="favorite_song"
            value={favoriteSong}
            onChange={(event) => setFavoriteSong(event.target.value)}
            maxLength={80}
            className="field"
            placeholder="Nome da música"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="favorite_song_artist">
            Artista
          </label>
          <input
            id="favorite_song_artist"
            value={favoriteSongArtist}
            onChange={(event) => setFavoriteSongArtist(event.target.value)}
            maxLength={80}
            className="field"
            placeholder="Quem canta"
          />
        </div>
      </div>

      <div className="rounded-xl border border-line p-3">
        <span className="field-label">Música que toca no seu perfil</span>
        <label htmlFor="song_url" className="sr-only">
          Link da música
        </label>
        <input
          id="song_url"
          value={songUrl}
          onChange={(event) => setSongUrl(event.target.value.trim())}
          maxLength={500}
          className="field text-sm"
          placeholder="Cole o link do YouTube, Spotify, SoundCloud, Deezer ou Apple Music"
        />
        <p className="mt-1.5 text-[0.68rem] text-muted">
          Cola o link e pronto: o player oficial aparece no seu perfil. Também dá para enviar um
          MP3 de até 15 MB.
        </p>
        {musicSource && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.68rem] font-semibold text-accent">
            <Music2 size={10} /> {musicSource.label} reconhecido
          </p>
        )}
        {songUrl && musicSource?.kind === "audio" && (
          <audio controls src={musicSource.embedUrl} className="mt-2 w-full" />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label
            className={cn(
              "btn btn-ghost !px-3 !py-1.5 text-xs",
              uploading === "song" && "pointer-events-none opacity-60",
            )}
          >
            {uploading === "song" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Music2 size={13} />
            )}
            {uploading === "song" ? "Enviando" : songUrl ? "Trocar música" : "Enviar música"}
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadSong(file);
                event.target.value = "";
              }}
            />
          </label>
          {songUrl && (
            <button
              type="button"
              onClick={() => setSongUrl("")}
              className="btn btn-quiet !px-2.5 !py-1.5 text-xs text-danger"
            >
              <Trash2 size={12} /> remover
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[0.68rem] text-muted">
          No YouTube e no Deezer o player só carrega quando alguém toca no play do perfil.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <div>
          <label className="field-label" htmlFor="location">
            Localização
          </label>
          <div className="relative">
            <MapPin
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={60}
              className="field pl-8"
              placeholder="Cidade, país"
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-line p-3"
        style={profileAccentStyle(accentColor)}
      >
        <span className="field-label">Cor do perfil</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAccentColor(null)}
            className={cn(
              "h-7 rounded-full border border-line px-2.5 text-[0.68rem] font-medium",
              !accentColor ? "ring-2 ring-ink/40" : "text-muted",
            )}
          >
            padrão
          </button>
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccentColor(color)}
              aria-label={`Usar a cor ${color}`}
              aria-pressed={accentColor === color}
              className={cn(
                "h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110",
                accentColor === color && "ring-2 ring-offset-2 ring-ink/50",
              )}
              style={{ background: color }}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.7rem] text-muted">
          A cor vale para os botões e destaques do seu perfil.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-line p-3">
        <span className="field-label !mb-0">Estilo do perfil</span>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "modern", label: "Moderno" },
            { id: "y2k", label: "Anos 2000 ✨" },
          ].map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setProfileStyle(style.id)}
              aria-pressed={profileStyle === style.id}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                profileStyle === style.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-line pt-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(event) => setShowStats(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Mostrar número de publicações para todos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showVisits}
              onChange={(event) => setShowVisits(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Mostrar contador de visitas no perfil
          </label>
        </div>
      </div>

      <div>
        <span className="field-label">Fonte do nome</span>
        <div className="flex flex-wrap gap-1.5">
          {NAME_FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => setNameFont(font.id)}
              aria-pressed={nameFont === font.id}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-sm",
                font.className,
                nameFont === font.id
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
        <p className={cn("mt-2 text-lg font-semibold leading-tight", previewNameFont)}>
          {displayName || profile.display_name}
        </p>
      </div>

      <button type="submit" disabled={pending || uploading !== null} className="btn btn-primary">
        {pending && <Loader2 size={14} className="animate-spin" />}
        Salvar perfil
      </button>

      {cropFile && (
        <AvatarCrop
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={uploadAvatar}
        />
      )}
    </form>
  );
}
