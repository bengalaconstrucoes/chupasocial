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
  { id: "rainbow", label: "Arco-íris", hint: "Anel colorido.", className: "pfp-frame-rainbow" },
  { id: "fire", label: "Fogo", hint: "Laranja quente.", className: "pfp-frame-fire" },
  { id: "y2k", label: "Anos 2000", hint: "Cromado com brilho.", className: "pfp-frame-y2k" },
  { id: "cat", label: "Orelhas de gatinho", hint: "Miado com orelhinhas.", className: "pfp-frame-cat" },
  { id: "bunny", label: "Orelhas de coelho", hint: "Orelhas longas e fofas.", className: "pfp-frame-bunny" },
  { id: "rose", label: "Rosas", hint: "Pétalas rosadas.", className: "pfp-frame-rose" },
  { id: "sakura", label: "Sakura", hint: "Flor de cerejeira.", className: "pfp-frame-sakura" },
  { id: "hearts", label: "Corações", hint: "Aro de coração.", className: "pfp-frame-hearts" },
  { id: "stars", label: "Estrelinhas", hint: "Brilho estelar.", className: "pfp-frame-stars" },
  { id: "candy", label: "Doce", hint: "Listras de bala.", className: "pfp-frame-candy" },
  { id: "mint", label: "Menta", hint: "Verde suave.", className: "pfp-frame-mint" },
  { id: "lavender", label: "Lavanda", hint: "Lilás tranquilo.", className: "pfp-frame-lavender" },
  { id: "ocean", label: "Oceano", hint: "Azul profundo.", className: "pfp-frame-ocean" },
  { id: "sunset", label: "Pôr do sol", hint: "Laranja e rosa.", className: "pfp-frame-sunset" },
  { id: "ice", label: "Gelo", hint: "Azul cristalino.", className: "pfp-frame-ice" },
  { id: "galaxy", label: "Galáxia", hint: "Roxo com estrelas.", className: "pfp-frame-galaxy" },
  { id: "lime", label: "Limão", hint: "Verde aceso.", className: "pfp-frame-lime" },
  { id: "shadow", label: "Sombra", hint: "Preto discreto.", className: "pfp-frame-shadow" },
  { id: "admin", label: "Equipe", hint: "Reservada para a administração.", className: "pfp-frame-admin" },
];

export function normalizeAvatarFrame(value: string | null | undefined): string {
  return AVATAR_FRAMES.some((frame) => frame.id === value) ? (value as string) : "none";
}

export function avatarFrameClass(value: string | null | undefined): string {
  return AVATAR_FRAMES.find((frame) => frame.id === normalizeAvatarFrame(value))?.className ?? "";
}
