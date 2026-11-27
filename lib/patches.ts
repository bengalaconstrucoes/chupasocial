export type Patch = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

/** Registro de atualizações do site, exibido em /patches. */
export const PATCHES: Patch[] = [
  {
    version: "0.4.0",
    date: "2026-11-27",
    title: "Perfil turbinado, avisos e moderação",
    highlights: [
      "Música de fundo no perfil, começando a tocar ao abrir.",
      "Molduras de foto, emblemas de verificado e de equipe.",
      "Separação de publicações, reposts e respostas no perfil.",
      "Contagem de views em cada publicação e curtidas recebidas no perfil.",
      "Colar imagem direto no compositor com Ctrl+V.",
      "Vídeos de até 10 minutos nas publicações.",
      "Fundo do site com upload de imagem ou temas prontos.",
      "Assuntos do momento por tema, sem depender de hashtags.",
      "Avisos da administração com respostas em tempo real.",
      "Fila de moderação com sinalização automática de conteúdo.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-11-20",
    title: "Comunidades, salas e crescimento",
    highlights: [
      "Comunidades com aprovação, cargos, convites e emojis.",
      "Salas ao vivo com texto em tempo real.",
      "Stories, álbum de fotos, ranking semanal e retrospectiva.",
      "Painel administrativo de denúncias e feedback.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-11-10",
    title: "Chamadas e mensagens",
    highlights: [
      "Chamadas de áudio e vídeo em grupo com compartilhamento de tela.",
      "Mensagens temporárias e de visualização única.",
      "Presença online e aviso de digitando.",
    ],
  },
];
