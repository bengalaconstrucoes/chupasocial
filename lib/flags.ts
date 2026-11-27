/**
 * Bandeiras de perfil: estados brasileiros e bandeiras históricas.
 * Renderizadas em CSS (listras com as cores oficiais) para não depender de
 * imagens externas, e com o código do estado para identificação rápida.
 */
export type FlagItem = {
  id: string;
  label: string;
  code: string;
  colors: string[];
  group: "estados" | "historicas";
};

export const FLAGS: FlagItem[] = [
  // Estados brasileiros
  { id: "ac", label: "Acre", code: "AC", colors: ["#0b6b3a", "#f4d21c", "#c8102e"], group: "estados" },
  { id: "al", label: "Alagoas", code: "AL", colors: ["#c8102e", "#ffffff", "#1f4e9c"], group: "estados" },
  { id: "ap", label: "Amapá", code: "AP", colors: ["#1f7a3d", "#f4d21c", "#1f4e9c"], group: "estados" },
  { id: "am", label: "Amazonas", code: "AM", colors: ["#ffffff", "#c8102e", "#1f4e9c"], group: "estados" },
  { id: "ba", label: "Bahia", code: "BA", colors: ["#ffffff", "#c8102e", "#1f4e9c"], group: "estados" },
  { id: "ce", label: "Ceará", code: "CE", colors: ["#0b6b3a", "#f4d21c", "#ffffff"], group: "estados" },
  { id: "df", label: "Distrito Federal", code: "DF", colors: ["#ffffff", "#0b6b3a", "#f4d21c"], group: "estados" },
  { id: "es", label: "Espírito Santo", code: "ES", colors: ["#ffffff", "#1f4e9c", "#c8102e"], group: "estados" },
  { id: "go", label: "Goiás", code: "GO", colors: ["#0b6b3a", "#f4d21c", "#1f4e9c"], group: "estados" },
  { id: "ma", label: "Maranhão", code: "MA", colors: ["#ffffff", "#c8102e", "#1f4e9c"], group: "estados" },
  { id: "mt", label: "Mato Grosso", code: "MT", colors: ["#1f4e9c", "#ffffff", "#0b6b3a"], group: "estados" },
  { id: "ms", label: "Mato Grosso do Sul", code: "MS", colors: ["#1f4e9c", "#ffffff", "#0b6b3a"], group: "estados" },
  { id: "mg", label: "Minas Gerais", code: "MG", colors: ["#ffffff", "#c8102e", "#0b6b3a"], group: "estados" },
  { id: "pa", label: "Pará", code: "PA", colors: ["#1f4e9c", "#ffffff", "#c8102e"], group: "estados" },
  { id: "pb", label: "Paraíba", code: "PB", colors: ["#c8102e", "#1a1a1a", "#ffffff"], group: "estados" },
  { id: "pr", label: "Paraná", code: "PR", colors: ["#0b6b3a", "#ffffff", "#1f4e9c"], group: "estados" },
  { id: "pe", label: "Pernambuco", code: "PE", colors: ["#1f4e9c", "#ffffff", "#c8102e"], group: "estados" },
  { id: "pi", label: "Piauí", code: "PI", colors: ["#1f4e9c", "#ffffff", "#f4d21c"], group: "estados" },
  { id: "rj", label: "Rio de Janeiro", code: "RJ", colors: ["#1f4e9c", "#ffffff", "#1a1a1a"], group: "estados" },
  { id: "rn", label: "Rio Grande do Norte", code: "RN", colors: ["#ffffff", "#0b6b3a", "#f4d21c"], group: "estados" },
  { id: "rs", label: "Rio Grande do Sul", code: "RS", colors: ["#0b6b3a", "#c8102e", "#f4d21c"], group: "estados" },
  { id: "ro", label: "Rondônia", code: "RO", colors: ["#0b6b3a", "#f4d21c", "#1f4e9c"], group: "estados" },
  { id: "rr", label: "Roraima", code: "RR", colors: ["#1f4e9c", "#ffffff", "#0b6b3a"], group: "estados" },
  { id: "sc", label: "Santa Catarina", code: "SC", colors: ["#ffffff", "#c8102e", "#1a1a1a"], group: "estados" },
  { id: "sp", label: "São Paulo", code: "SP", colors: ["#1a1a1a", "#ffffff", "#c8102e"], group: "estados" },
  { id: "se", label: "Sergipe", code: "SE", colors: ["#1f4e9c", "#ffffff", "#c8102e"], group: "estados" },
  { id: "to", label: "Tocantins", code: "TO", colors: ["#1f4e9c", "#ffffff", "#f4d21c"], group: "estados" },

  // Bandeiras históricas
  { id: "brasil-imperio", label: "Império do Brasil", code: "1822", colors: ["#0b6b3a", "#f4d21c", "#1f4e9c"], group: "historicas" },
  { id: "brasil-colonia", label: "Brasil Colonial", code: "1500", colors: ["#ffffff", "#1f4e9c", "#c8102e"], group: "historicas" },
  { id: "brasil-republica-velha", label: "República Velha", code: "1889", colors: ["#0b6b3a", "#f4d21c", "#1f4e9c"], group: "historicas" },
  { id: "brasil-atual", label: "Brasil", code: "BR", colors: ["#0b6b3a", "#f4d21c", "#1f4e9c"], group: "historicas" },
  { id: "portugal", label: "Portugal", code: "PT", colors: ["#0b6b3a", "#c8102e", "#f4d21c"], group: "historicas" },
  { id: "holanda", label: "Países Baixos", code: "NL", colors: ["#c8102e", "#ffffff", "#1f4e9c"], group: "historicas" },
  { id: "espanha", label: "Espanha", code: "ES", colors: ["#c8102e", "#f4d21c", "#c8102e"], group: "historicas" },
  { id: "franca", label: "França", code: "FR", colors: ["#1f4e9c", "#ffffff", "#c8102e"], group: "historicas" },
];

export const FLAG_MAP = new Map(FLAGS.map((flag) => [flag.id, flag]));

export function findFlag(id: string | null | undefined): FlagItem | null {
  if (!id) return null;
  return FLAG_MAP.get(id) ?? null;
}

export function flagBackground(flag: FlagItem) {
  const colors = flag.colors;
  if (colors.length === 2) {
    return `linear-gradient(90deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`;
  }
  return `linear-gradient(90deg, ${colors[0]} 0 33.3%, ${colors[1]} 33.3% 66.6%, ${colors[2]} 66.6% 100%)`;
}
