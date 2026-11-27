export type Patch = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

/** Registro de atualizações do site, exibido em /patches. */
export const PATCHES: Patch[] = [
  {
    version: "0.6.1",
    date: "2026-11-27",
    title: "Feed que não repete o que você já viu",
    highlights: [
      "O \"Para você\" passou a lembrar das publicações que já apareceram para você e deixa elas para o fim da fila.",
      "Repost e publicação original não aparecem mais duplicados na mesma página.",
      "A ordem varia um pouco entre recargas, em vez de ficar sempre igual.",
      "O player do perfil toca escondido: só play/pause, nome da música e artista.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-11-27",
    title: "Abas do perfil, comunidades privadas e molduras fofas",
    highlights: [
      "Abas do perfil agora são Posts, Respostas e Reposts, com ícone e o nome aparecendo na aba ativa.",
      "Respostas mostram a publicação respondida em cima, como no Twitter.",
      "Comunidades podem ser privadas: as publicações ficam só para quem foi aceito.",
      "Banner com enquadramento ajustável no perfil e nas comunidades.",
      "Escolha quais emblemas aparecem no perfil — e desative estatísticas de verdade, sem o aviso de “ocultas”.",
      "Molduras novas estilo Discord: orelhas de gatinho, rosas, sakura e um monte de cores.",
      "Player de música enxuto: só o som e play/pause, sem vídeo, com cor da letra e do balãozinho.",
      "Patches segue só com avisos e atualizações; o chat em tempo real tem aba própria.",
      "Assuntos do momento saíram: ficou só o # em alta.",
      "Interface mais leve, com vidro suave e transições mais rápidas.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-11-27",
    title: "Chat de 24h, patches e música por link",
    highlights: [
      "Chat público em tempo real, com mensagens que somem sozinhas depois de 24 horas.",
      "Avisos e novidades agora são uma aba só: Patches.",
      "Música no perfil colando link do YouTube, Spotify, SoundCloud, Deezer ou Apple Music.",
      "Painel de administração com busca e selo de admin ou verificado para qualquer conta.",
      "Botão de tema claro/escuro mudou para Configurações → Aparência.",
      "Perfil estilo anos 2000 repaginado, com cara de MySpace: coluna do perfil, Sobre mim e Top 8.",
    ],
  },
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
