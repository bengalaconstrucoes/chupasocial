/** Lista e normalização dos fundos do site — seguras no servidor e no cliente. */
export const BACKGROUND_THEMES = [
  { id: "none", label: "Nenhum", hint: "Fundo limpo, sem animação." },
  { id: "aurora", label: "Aurora", hint: "Degradê suave de rosa e azul." },
  { id: "sunset", label: "Pôr do sol", hint: "Laranja quente com roxo." },
  { id: "grid", label: "Grade retrô", hint: "Linhas discretas estilo anos 2000." },
  { id: "snow", label: "Neve", hint: "Flocos caindo bem devagar." },
  { id: "stars", label: "Estrelas", hint: "Céu piscando ao fundo." },
  { id: "bubbles", label: "Bolhas", hint: "Bolhas subindo pela tela." },
  { id: "custom", label: "Minha imagem", hint: "Envie uma foto para o fundo." },
] as const;

export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number]["id"];

export const BACKGROUND_COOKIE = "chupa-bg";
export const BACKGROUND_IMAGE_COOKIE = "chupa-bg-image";

const VALID = new Set<string>(BACKGROUND_THEMES.map((theme) => theme.id));

export function normalizeBackground(value: string | null | undefined): BackgroundTheme {
  return value && VALID.has(value) ? (value as BackgroundTheme) : "none";
}

/** Normaliza uma URL de imagem de fundo (só https do próprio Supabase). */
export function normalizeBackgroundImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https:\/\/[^\s"']+$/i.test(value)) return null;
  if (value.length > 500) return null;
  return value;
}

/** Camadas de fundo que não precisam de partículas. */
export function backgroundLayerCss(theme: BackgroundTheme, imageUrl?: string | null) {
  if (theme === "custom") {
    const url = normalizeBackgroundImage(imageUrl);
    if (!url) return null;
    return {
      backgroundImage: `linear-gradient(color-mix(in srgb, var(--bg) 55%, transparent), color-mix(in srgb, var(--bg) 80%, transparent)), url("${url}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    } as const;
  }

  if (theme === "aurora") {
    return {
      backgroundImage:
        "radial-gradient(60% 50% at 15% 10%, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 70%), radial-gradient(55% 45% at 85% 30%, color-mix(in srgb, #3ba7d6 20%, transparent) 0%, transparent 70%), radial-gradient(50% 40% at 50% 100%, color-mix(in srgb, #7d5cd6 18%, transparent) 0%, transparent 70%)",
    } as const;
  }

  if (theme === "sunset") {
    return {
      backgroundImage:
        "radial-gradient(70% 55% at 20% 100%, color-mix(in srgb, #f08a3c 24%, transparent) 0%, transparent 70%), radial-gradient(60% 50% at 85% 0%, color-mix(in srgb, #7d3fa0 22%, transparent) 0%, transparent 70%)",
    } as const;
  }

  if (theme === "grid") {
    return {
      backgroundImage:
        "linear-gradient(color-mix(in srgb, var(--line) 55%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--line) 55%, transparent) 1px, transparent 1px)",
      backgroundSize: "34px 34px",
      backgroundPosition: "center",
    } as const;
  }

  return null;
}

export function isParticleTheme(theme: BackgroundTheme) {
  return theme === "snow" || theme === "stars" || theme === "bubbles";
}
