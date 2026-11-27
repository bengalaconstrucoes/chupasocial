/**
 * Triagem de conteúdo do ChupaSocial.
 *
 * - `block`: recusa a publicação na hora (conteúdo sexual envolvendo menores e
 *   incentivo explícito a violência).
 * - `flag`: deixa publicar, mas entra na fila de moderação do painel admin
 *   (gore, ameaça, discurso de ódio).
 *
 * A lista é curta e conservadora de propósito: falso positivo em moderação é
 * pior do que mandar um caso duvidoso para revisão humana.
 */
export type ModerationResult = {
  blocked: boolean;
  reason?: string;
  flags: Array<{ reason: string; severity: "review" | "high" }>;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const MINOR = /\b(crianca|criancas|menor|menores|adolescente|pre-adolescente|kid|kids|child|children)\b/;
const SEXUAL = /\b(sexo|sexual|nude|nudes|nudez|pornografia|porno|pelad[oa]s?|transar)\b/;
const GORE =
  /\b(gore|esquartej\w*|decapita\w*|tortura\w*|sangue jorrando|entranhas|corpo mutilado|matar todos|vou te matar)\b/;
const HATE =
  /\b(viado|bicha|traveco|retardado|mongoloid[eo]|nazista|heil hitler|morte aos)\b/;

export function screenContent(raw: string): ModerationResult {
  const text = normalize(raw ?? "");
  const flags: ModerationResult["flags"] = [];

  if (!text.trim()) return { blocked: false, flags };

  // Pedido ou oferta de conteúdo sexual com menores: bloqueia sem discussão.
  if (MINOR.test(text) && SEXUAL.test(text)) {
    return {
      blocked: true,
      reason:
        "Isso não pode ser publicado aqui. Conteúdo sexual envolvendo menores é proibido e pode ser reportado às autoridades.",
      flags: [],
    };
  }

  if (GORE.test(text)) {
    flags.push({ reason: "violência explícita", severity: "high" });
  }
  if (HATE.test(text)) {
    flags.push({ reason: "discurso de ódio", severity: "review" });
  }

  return { blocked: false, flags };
}

export function moderationLabel(reason: string) {
  return reason;
}
