import type { AchievementCounts } from "@/lib/queries";

export type EarnedBadge = {
  id: string;
  label: string;
  emoji: string;
  hint: string;
};

/** Conquistas calculadas a partir das contagens do perfil. */
export function computeBadges(counts: AchievementCounts): EarnedBadge[] {
  const badges: EarnedBadge[] = [];

  if (counts.days >= 365) {
    badges.push({ id: "lenda", label: "Lenda", emoji: "🏆", hint: "Mais de um ano de ChupaSocial" });
  } else if (counts.days >= 30) {
    badges.push({ id: "veterano", label: "Veterano", emoji: "🕰️", hint: "Um mês ou mais por aqui" });
  } else if (counts.days >= 7) {
    badges.push({ id: "morador", label: "Morador", emoji: "🏡", hint: "Uma semana de conta" });
  }

  if (counts.posts >= 100) {
    badges.push({ id: "cronista", label: "Cronista", emoji: "📚", hint: "100 publicações" });
  } else if (counts.posts >= 25) {
    badges.push({ id: "escritor", label: "Escritor", emoji: "✍️", hint: "25 publicações" });
  } else if (counts.posts >= 1) {
    badges.push({ id: "primeiro-post", label: "Primeira palavra", emoji: "🌱", hint: "Já publicou algo" });
  }

  if (counts.likes >= 500) {
    badges.push({ id: "estrela", label: "Estrela", emoji: "🌟", hint: "500 curtidas recebidas" });
  } else if (counts.likes >= 50) {
    badges.push({ id: "querido", label: "Querido", emoji: "💛", hint: "50 curtidas recebidas" });
  }

  if (counts.followers >= 100) {
    badges.push({ id: "influente", label: "Influente", emoji: "👑", hint: "100 seguidores" });
  } else if (counts.followers >= 10) {
    badges.push({ id: "popular", label: "Popular", emoji: "🫂", hint: "10 seguidores" });
  }

  if (counts.communities >= 5) {
    badges.push({ id: "colecionador", label: "Colecionador de comunidades", emoji: "🏘️", hint: "5 comunidades" });
  } else if (counts.communities >= 1) {
    badges.push({ id: "community", label: "Gente de comunidade", emoji: "🤝", hint: "Participa de uma comunidade" });
  }

  return badges;
}
