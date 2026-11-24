"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="chip">Algo deu errado</p>
      <h1 className="text-2xl font-semibold">Não conseguimos carregar esta parte</h1>
      <p className="max-w-md text-sm text-muted">
        Pode ser um problema temporário de conexão. Tente novamente; se persistir, volte para o
        início.
      </p>
      <div className="mt-2 flex gap-2">
        <button className="btn btn-primary" onClick={reset}>
          Tentar de novo
        </button>
        <a className="btn btn-ghost" href="/">
          Ir para o início
        </a>
      </div>
    </div>
  );
}
