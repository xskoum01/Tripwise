"use client";

import { useState } from "react";

type CopyRouteButtonProps = {
  text: string;
};

export function CopyRouteButton({ text }: CopyRouteButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silently ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
        copied
          ? "bg-sea/15 text-sea"
          : "bg-ink/5 text-ink/50 hover:bg-ink/10 hover:text-ink/70"
      }`}
      title="Zkopírovat trasu do schránky"
      type="button"
    >
      {copied ? "Zkopírováno" : "Zkopírovat trasu"}
    </button>
  );
}
