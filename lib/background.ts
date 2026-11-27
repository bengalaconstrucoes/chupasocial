/** Lista e normalização dos fundos animados — seguras no servidor e no cliente. */
export const BACKGROUND_THEMES = [
  { id: "none", label: "Nenhum", hint: "Fundo limpo, sem animação." },
  { id: "snow", label: "Neve", hint: "Flocos caindo bem devagar." },
  { id: "stars", label: "Estrelas", hint: "Céu piscando ao fundo." },
  { id: "bubbles", label: "Bolhas", hint: "Bolhas subindo pela tela." },
] as const;

export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number]["id"];

export const BACKGROUND_COOKIE = "chupa-bg";

const VALID = new Set<string>(BACKGROUND_THEMES.map((theme) => theme.id));

export function normalizeBackground(value: string | null | undefined): BackgroundTheme {
  return value && VALID.has(value) ? (value as BackgroundTheme) : "none";
}
