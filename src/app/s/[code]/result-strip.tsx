"use client";

import { useEffect, useRef, useState } from "react";
import { loadImage, renderStrip } from "@/lib/strip";
import { templateById, type TemplateId } from "@/lib/templates";

export default function ResultStrip({
  code,
  template,
  photoAKeys,
  photoBKeys,
  createdAtISO,
}: {
  code: string;
  template: TemplateId;
  photoAKeys: string[];
  photoBKeys: string[];
  createdAtISO: string;
}) {
  const fontProbeRef = useRef<HTMLSpanElement>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [photosA, photosB] = await Promise.all([
          Promise.all(photoAKeys.map((k) => loadImage(`/api/photos/${k}`))),
          Promise.all(photoBKeys.map((k) => loadImage(`/api/photos/${k}`))),
        ]);
        if (cancelled) return;

        // Pakai font display yang sudah dimuat halaman untuk footer strip.
        const fontFamily = fontProbeRef.current
          ? getComputedStyle(fontProbeRef.current).fontFamily
          : undefined;

        const canvas = document.createElement("canvas");
        await renderStrip(canvas, photosA, photosB, {
          date: new Date(createdAtISO),
          code,
          fontFamily,
          def: templateById(template),
        });
        if (cancelled) return;

        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          revoked = URL.createObjectURL(blob);
          setStripUrl(revoked);
        }, "image/png");
      } catch {
        if (!cancelled) setError("Gagal menyusun strip. Muat ulang halaman ya.");
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [code, template, photoAKeys, photoBKeys, createdAtISO]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <span ref={fontProbeRef} aria-hidden className="font-display sr-only">
        probe
      </span>

      {error && <p className="text-center text-sm text-flash">{error}</p>}

      {!stripUrl && !error && (
        <p className="animate-pulse text-sm text-paper/70">Nyusun strip kalian…</p>
      )}

      {stripUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stripUrl}
            alt="Strip photobox kalian"
            className="w-full -rotate-1 rounded-sm shadow-[0_24px_60px_-12px_rgb(0_0_0/0.7)]"
          />
          <a
            href={stripUrl}
            download={`fotoin-bareng-${code}.png`}
            className="rounded-full bg-flash px-8 py-4 font-display text-sm font-bold tracking-wider text-ink shadow-lg transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          >
            UNDUH STRIP
          </a>
        </>
      )}
    </div>
  );
}
