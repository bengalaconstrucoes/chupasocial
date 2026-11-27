/** Molduras de foto de perfil. Renderizadas em CSS, sem imagens externas. */
export type AvatarFrame = {
  id: string;
  label: string;
  hint: string;
  className: string;
};

export const AVATAR_FRAMES: AvatarFrame[] = [
  { id: "none", label: "Sem moldura", hint: "Foto limpa.", className: "" },
  { id: "gold", label: "Ouro", hint: "Aro dourado.", className: "pfp-frame-gold" },
  { id: "neon", label: "Neon", hint: "Brilho rosa e azul.", className: "pfp-frame-neon" },
  { id: "rainbow", label: "Arco-íris", hint: "Anel colorido girando.", className: "pfp-frame-rainbow" },
  { id: "fire", label: "Fogo", hint: "Laranja quente.", className: "pfp-frame-fire" },
  { id: "y2k", label: "Anos 2000", hint: "Cromado com brilho.", className: "pfp-frame-y2k" },
  { id: "admin", label: "Equipe", hint: "Reservada para a administração.", className: "pfp-frame-admin" },
];

export function normalizeAvatarFrame(value: string | null | undefined): string {
  return AVATAR_FRAMES.some((frame) => frame.id === value) ? (value as string) : "none";
}

export function avatarFrameClass(value: string | null | undefined): string {
  return AVATAR_FRAMES.find((frame) => frame.id === normalizeAvatarFrame(value))?.className ?? "";
}
