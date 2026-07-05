"use client";

import { useEffect, useRef } from "react";
import { loadImage, renderStrip } from "@/lib/strip";
import type { TemplateDef } from "@/lib/templates";

// Placeholder "foto orang": siluet sederhana di atas tone kertas foto.
// Di-cache module-level karena dipakai semua kartu preview sekaligus.
let placeholderCache: Promise<[HTMLImageElement, HTMLImageElement]> | null = null;

function makePlaceholder(bg: string, fg: string): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D tidak tersedia"));

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = fg;
  // kepala
  ctx.beginPath();
  ctx.arc(200, 128, 52, 0, Math.PI * 2);
  ctx.fill();
  // bahu
  ctx.beginPath();
  ctx.ellipse(200, 300, 118, 105, 0, Math.PI, 0);
  ctx.fill();

  return loadImage(canvas.toDataURL("image/png"));
}

function placeholders() {
  placeholderCache ??= Promise.all([
    makePlaceholder("#d9cbb4", "#b3a289"),
    makePlaceholder("#c9b8a2", "#a08d74"),
  ]);
  return placeholderCache;
}

export default function StripPreview({
  def,
  className,
}: {
  def: TemplateDef;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [personA, personB] = await placeholders();
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      await renderStrip(
        canvas,
        Array.from({ length: def.shots }, () => personA),
        Array.from({ length: def.shots }, () => personB),
        {
          date: new Date(),
          code: "kamu × dia",
          def,
          fontFamily: getComputedStyle(canvas).fontFamily,
        }
      );
    })().catch(() => {
      // Preview gagal render bukan hal fatal — kartu tetap bisa dipilih.
    });
    return () => {
      cancelled = true;
    };
  }, [def]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Preview template ${def.label}`}
      className={`font-display ${className ?? ""}`}
    />
  );
}
