"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium transition hover:border-brand"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
