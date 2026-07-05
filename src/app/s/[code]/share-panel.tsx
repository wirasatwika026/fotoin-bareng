"use client";

import { useState } from "react";

export default function SharePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/s/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bisa ditolak browser; biarkan user salin manual dari kolom kode.
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl bg-booth-soft p-6 text-center">
      <p className="text-sm text-paper/80">Bagikan ke dia — dibuka kapan saja:</p>
      <p className="mt-3 rounded-md bg-black/30 px-4 py-3 font-mono text-lg tracking-widest text-flash">
        {code}
      </p>
      <button
        onClick={copyLink}
        className="mt-4 rounded-full bg-flash px-6 py-3 font-display text-sm font-bold text-ink transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
      >
        {copied ? "TERSALIN ✓" : "SALIN LINK"}
      </button>
    </div>
  );
}
