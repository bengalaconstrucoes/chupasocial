import { cn } from "@/lib/utils";

const TIPS = [
  "Ctrl+V também cola imagem direto no compositor.",
  "Dá para escolher uma moldura para a foto do perfil em Configurações.",
  "Vídeos de até 10 minutos cabem nas publicações.",
  "Responda aos avisos da administração no fórum em tempo real.",
  "Publicações com vídeo ficam melhores com uma capa chamativa.",
  "Use o álbum do perfil para guardar suas fotos favoritas.",
  "Quem você segue aparece primeiro no feed Para você.",
  "Dá para silenciar a música de um perfil no botão de volume.",
];

function pickTip() {
  const now = new Date();
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate();
  return TIPS[seed % TIPS.length];
}

export function Ducky({
  className,
  tip,
  compact = false,
}: {
  className?: string;
  tip?: string;
  compact?: boolean;
}) {
  const message = tip ?? pickTip();

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span className="chupa-ducky shrink-0" aria-hidden>
        <svg viewBox="0 0 64 64" width={compact ? 36 : 48} height={compact ? 36 : 48}>
          <ellipse cx="34" cy="26" rx="17" ry="14" fill="#ffd447" />
          <circle cx="30" cy="20" r="2.4" fill="#2a2230" />
          <circle cx="30.8" cy="19.2" r="0.8" fill="#fff" />
          <path d="M43 26l10 3-10 4z" fill="#f08a1d" />
          <path
            d="M18 38c0-5 7-9 16-9s16 4 16 9-7 12-16 12-16-7-16-12z"
            fill="#ffdf6b"
          />
          <path d="M22 47c-4 1-6 3-6 4s4 2 7 0z" fill="#f7c62f" />
          <path d="M30 33c4-2 10-2 14 0" stroke="#f0b93a" strokeWidth="1.6" fill="none" />
        </svg>
      </span>

      <div className="min-w-0 rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-2">
        <p className="text-[0.66rem] font-bold uppercase tracking-wide text-accent">Ducky</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{message}</p>
      </div>
    </div>
  );
}
