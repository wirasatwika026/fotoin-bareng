// Penggambaran strip photobox di canvas (jalan di browser).
// Seluruh geometri, warna, pola, dan ornamen mengikuti TemplateDef (murni data).
// Urutan lapisan: warna kertas → pola → foto → ornamen → footer.

import type { StripPattern, TemplateDef } from "./templates";

const CELL_W = 560;
const CELL_H = 420;
const GAP = 20;
const MARGIN = 36;
const FOOTER_H = 120;

// Lebar area konten tetap di semua template; jumlah kolom membagi lebar ini.
const INNER_W = CELL_W * 2 + GAP;

/**
 * Rasio (lebar/tinggi) satu slot foto per orang pada template ini.
 * Dipakai kamera agar preview & hasil capture persis framing hasil cetak.
 */
export function photoAspect(def: TemplateDef): number {
  const columns = def.columns ?? 1;
  const frameW = (INNER_W - (columns - 1) * GAP) / columns;
  const cellH = def.cellH ?? CELL_H;
  const photoW = def.joined ? frameW / 2 : (frameW - GAP) / 2;
  return photoW / cellH;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    img.src = src;
  });
}

// Ornamen dipakai berulang antar-preview; cache promise-nya per path.
const ornamentCache = new Map<string, Promise<HTMLImageElement>>();

function loadOrnament(src: string): Promise<HTMLImageElement> {
  let cached = ornamentCache.get(src);
  if (!cached) {
    cached = loadImage(src);
    ornamentCache.set(src, cached);
  }
  return cached;
}

/** Gambar `img` memenuhi sel (cover-crop, tanpa distorsi). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: StripPattern,
  width: number,
  height: number
) {
  ctx.fillStyle = pattern.color;
  if (pattern.type === "stripes") {
    for (let x = 0; x < width; x += pattern.width + pattern.gap) {
      ctx.fillRect(x, 0, pattern.width, height);
    }
  } else {
    // Barisan titik selang-seling setengah spacing, seperti kertas kado.
    for (let row = 0, y = pattern.spacing / 2; y < height; y += pattern.spacing, row++) {
      const offset = row % 2 === 0 ? pattern.spacing / 2 : pattern.spacing;
      for (let x = offset; x < width; x += pattern.spacing) {
        ctx.beginPath();
        ctx.arc(x, y, pattern.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export async function renderStrip(
  canvas: HTMLCanvasElement,
  photosA: HTMLImageElement[],
  photosB: HTMLImageElement[],
  opts: { date: Date; code: string; def: TemplateDef; fontFamily?: string }
) {
  const { def } = opts;
  const columns = def.columns ?? 1;
  const rows = Math.ceil(def.shots / columns);
  const cellH = def.cellH ?? CELL_H;
  const footerH = def.footerH ?? FOOTER_H;
  const frameW = (INNER_W - (columns - 1) * GAP) / columns;

  const width = MARGIN * 2 + INNER_W;
  const height = MARGIN + rows * cellH + (rows - 1) * GAP + footerH;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");

  const font = opts.fontFamily ?? "sans-serif";

  // Lapisan 1 & 2: kertas + pola
  ctx.fillStyle = def.background.color;
  ctx.fillRect(0, 0, width, height);
  if (def.background.pattern) {
    drawPattern(ctx, def.background.pattern, width, height);
  }

  // Lapisan 3: foto — tiap frame (pasangan A|B) diposisikan baris-kolom,
  // digambar relatif terhadap pusatnya supaya bisa dimiringkan (tilt).
  for (let f = 0; f < def.shots; f++) {
    const col = f % columns;
    const row = Math.floor(f / columns);
    const x = MARGIN + col * (frameW + GAP);
    const y = MARGIN + row * (cellH + GAP);
    const tilt = def.tilt ? def.tilt[f % def.tilt.length] : 0;

    ctx.save();
    ctx.translate(x + frameW / 2, y + cellH / 2);
    if (tilt) ctx.rotate((tilt * Math.PI) / 180);

    if (def.photoFrame) {
      const bw = def.photoFrame.width;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = def.photoFrame.color;
      ctx.fillRect(-frameW / 2 - bw, -cellH / 2 - bw, frameW + bw * 2, cellH + bw * 2);
      ctx.restore();
    }

    if (def.joined) {
      const halfW = frameW / 2;
      if (photosA[f]) drawCover(ctx, photosA[f], -halfW, -cellH / 2, halfW, cellH);
      if (photosB[f]) drawCover(ctx, photosB[f], 0, -cellH / 2, halfW, cellH);
    } else {
      const cw = (frameW - GAP) / 2;
      if (photosA[f]) drawCover(ctx, photosA[f], -frameW / 2, -cellH / 2, cw, cellH);
      if (photosB[f]) drawCover(ctx, photosB[f], -frameW / 2 + cw + GAP, -cellH / 2, cw, cellH);
    }
    ctx.restore();
  }

  // Lapisan 4: ornamen
  if (def.ornaments?.length) {
    const images = await Promise.all(def.ornaments.map((o) => loadOrnament(o.src)));
    def.ornaments.forEach((o, i) => {
      const size = o.size * width;
      ctx.save();
      ctx.translate(o.cx * width, o.cy * height);
      if (o.rotate) ctx.rotate((o.rotate * Math.PI) / 180);
      ctx.drawImage(images[i], -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  }

  // Lapisan 5: footer
  const footerTop = MARGIN + rows * cellH + (rows - 1) * GAP;
  ctx.textAlign = "center";

  // Canvas tidak punya letter-spacing; beri spasi manual agar terasa seperti cetakan strip.
  ctx.fillStyle = def.inkStrong;
  ctx.font = `700 30px ${font}`;
  ctx.fillText("F O T O I N   B A R E N G", width / 2, footerTop + footerH * 0.45);

  const dateText = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(opts.date);
  ctx.fillStyle = def.inkSoft;
  ctx.font = `400 22px ${font}`;
  ctx.fillText(`${dateText}  ·  ${opts.code}`, width / 2, footerTop + footerH * 0.45 + 36);
}
