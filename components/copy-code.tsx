"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function RecoveryCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sem clipboard (http ou permissão negada): o código continua visível e selecionável.
    }
  }

  return (
    <div className="space-y-2">
      <code className="block select-all break-all rounded-lg border border-line bg-surface-2 px-3 py-2.5 font-mono text-sm tracking-[0.14em]">
        {code}
      </code>
      <button type="button" onClick={copy} className="btn btn-ghost w-full">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "Copiar código"}
      </button>
    </div>
  );
}
