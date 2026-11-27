import type { CSSProperties } from "react";

export const NAME_FONTS = [
  { id: "default", label: "Padrão", className: "" },
  { id: "serif", label: "Serifa", className: "name-font-serif" },
  { id: "mono", label: "Mono", className: "name-font-mono" },
  { id: "rounded", label: "Arredondada", className: "name-font-rounded" },
  { id: "condensed", label: "Condensada", className: "name-font-condensed" },
] as const;

export type NameFont = (typeof NAME_FONTS)[number]["id"];

export const ACCENT_COLORS = [
  "#d6315f",
  "#e0533d",
  "#d9861f",
  "#3f9d5a",
  "#2f8fbf",
  "#6a5acd",
  "#a044b8",
  "#3b3a44",
] as const;

export function normalizeNameFont(value: string | null | undefined): NameFont {
  return NAME_FONTS.some((font) => font.id === value) ? (value as NameFont) : "default";
}

export function nameFontClass(value: string | null | undefined) {
  return NAME_FONTS.find((font) => font.id === normalizeNameFont(value))?.className ?? "";
}

export function normalizeAccent(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function accentInk(hex: string) {
  return luminance(hex) > 0.45 ? "#1a0710" : "#ffffff";
}

export function profileAccentStyle(accent: string | null | undefined): CSSProperties | undefined {
  const color = normalizeAccent(accent);
  if (!color) return undefined;

  return {
    "--accent": color,
    "--accent-ink": accentInk(color),
    "--accent-soft": `color-mix(in srgb, ${color} 15%, transparent)`,
  } as CSSProperties;
}
