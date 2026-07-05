// Definisi template strip — MURNI DATA (bisa di-serialize ke JSON).
// Renderer di strip.ts menginterpretasikan struktur ini, jadi ke depan
// template bisa disimpan di DB / dibuat lewat UI tanpa mengubah kode canvas.
// Menambah template = menambah satu entri TEMPLATE_DEFS.

export const CATEGORIES = ["Basic", "Momen"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TEMPLATE_IDS = [
  "couple",
  "classic",
  "polaroid",
  "quad",
  "grid2",
  "scrapbook",
  "birthday",
  "love",
  "natal",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Pola yang digambar di atas warna kertas (di bawah foto). */
export type StripPattern =
  | { type: "stripes"; color: string; width: number; gap: number }
  | { type: "dots"; color: string; radius: number; spacing: number };

/** Ornamen gambar transparan di atas foto. Posisi & ukuran fraksi kanvas (0..1). */
export type Ornament = {
  src: string;
  cx: number;
  cy: number;
  /** Ukuran relatif terhadap lebar kanvas. */
  size: number;
  /** Derajat, searah jarum jam. */
  rotate?: number;
};

export type TemplateDef = {
  id: TemplateId;
  label: string;
  tagline: string;
  category: Category;
  /** Jumlah pose per orang. */
  shots: number;
  /** true = foto berdua nempel jadi satu frame; false = berdampingan bercelah. */
  joined: boolean;
  background: {
    color: string;
    pattern?: StripPattern;
  };
  /** Warna teks footer utama & sekunder (kontras dengan kertas). */
  inkStrong: string;
  inkSoft: string;
  ornaments?: Ornament[];
  /** Jumlah frame per baris (default 1 = strip vertikal). */
  columns?: number;
  /** Override tinggi sel foto & tinggi footer (px kanvas). */
  cellH?: number;
  footerH?: number;
  /** Kemiringan per frame (derajat), dipakai bergiliran/siklis. */
  tilt?: number[];
  /** Bingkai kartu di sekeliling tiap frame (gaya scrapbook/polaroid mini). */
  photoFrame?: { color: string; width: number };
};

const PAPER_CREAM = "#faf5eb";
const INK_DARK = "#26181c";
const INK_DARK_SOFT = "rgba(38, 24, 28, 0.6)";

export const TEMPLATE_DEFS: Record<TemplateId, TemplateDef> = {
  couple: {
    id: "couple",
    label: "Couple",
    tagline: "3 pose, nyatu satu frame",
    category: "Basic",
    shots: 3,
    joined: true,
    background: { color: PAPER_CREAM },
    inkStrong: INK_DARK,
    inkSoft: INK_DARK_SOFT,
  },
  classic: {
    id: "classic",
    label: "Klasik",
    tagline: "3 pose berdampingan",
    category: "Basic",
    shots: 3,
    joined: false,
    background: { color: PAPER_CREAM },
    inkStrong: INK_DARK,
    inkSoft: INK_DARK_SOFT,
  },
  polaroid: {
    id: "polaroid",
    label: "Polaroid",
    tagline: "1 pose besar, bingkai tebal",
    category: "Basic",
    shots: 1,
    joined: true,
    background: { color: PAPER_CREAM },
    inkStrong: INK_DARK,
    inkSoft: INK_DARK_SOFT,
    cellH: 855,
    footerH: 210,
  },
  quad: {
    id: "quad",
    label: "Midnight",
    tagline: "4 pose, kertas gelap",
    category: "Basic",
    shots: 4,
    joined: true,
    background: { color: "#1d1620" },
    inkStrong: PAPER_CREAM,
    inkSoft: "rgba(250, 245, 235, 0.55)",
  },
  grid2: {
    id: "grid2",
    label: "Grid Berdua",
    tagline: "4 pose kotak, siap feed",
    category: "Basic",
    shots: 4,
    joined: true,
    columns: 2,
    background: { color: PAPER_CREAM },
    inkStrong: INK_DARK,
    inkSoft: INK_DARK_SOFT,
  },
  scrapbook: {
    id: "scrapbook",
    label: "Scrapbook",
    tagline: "3 pose miring berbingkai",
    category: "Basic",
    shots: 3,
    joined: true,
    tilt: [-2, 1.6, -1.8],
    photoFrame: { color: "#fffdf7", width: 14 },
    background: {
      color: "#dbc9aa",
      pattern: { type: "dots", color: "rgba(62, 47, 28, 0.12)", radius: 4, spacing: 48 },
    },
    inkStrong: "#3e2f1c",
    inkSoft: "rgba(62, 47, 28, 0.6)",
  },
  birthday: {
    id: "birthday",
    label: "Ulang Tahun",
    tagline: "3 pose penuh confetti",
    category: "Momen",
    shots: 3,
    joined: true,
    background: {
      color: "#fff6e4",
      pattern: { type: "dots", color: "rgba(226, 85, 122, 0.25)", radius: 5, spacing: 56 },
    },
    inkStrong: "#4a2c18",
    inkSoft: "rgba(74, 44, 24, 0.6)",
    ornaments: [
      { src: "/ornaments/confetti.svg", cx: 0.09, cy: 0.035, size: 0.13, rotate: -12 },
      { src: "/ornaments/confetti.svg", cx: 0.91, cy: 0.035, size: 0.13, rotate: 148 },
      { src: "/ornaments/confetti.svg", cx: 0.12, cy: 0.955, size: 0.11, rotate: 62 },
      { src: "/ornaments/confetti.svg", cx: 0.88, cy: 0.955, size: 0.11, rotate: -95 },
    ],
  },
  love: {
    id: "love",
    label: "Sayang",
    tagline: "2 pose buat kalian berdua",
    category: "Momen",
    shots: 2,
    joined: true,
    background: {
      color: "#fbe9ee",
      pattern: { type: "stripes", color: "rgba(226, 85, 122, 0.08)", width: 14, gap: 42 },
    },
    inkStrong: "#58222f",
    inkSoft: "rgba(88, 34, 47, 0.6)",
    ornaments: [
      { src: "/ornaments/heart.svg", cx: 0.075, cy: 0.03, size: 0.07, rotate: -15 },
      { src: "/ornaments/heart.svg", cx: 0.93, cy: 0.045, size: 0.05, rotate: 20 },
      { src: "/ornaments/heart.svg", cx: 0.5, cy: 0.505, size: 0.06 },
      { src: "/ornaments/heart.svg", cx: 0.9, cy: 0.96, size: 0.055, rotate: 12 },
    ],
  },
  natal: {
    id: "natal",
    label: "Natal",
    tagline: "3 pose hangat akhir tahun",
    category: "Momen",
    shots: 3,
    joined: false,
    background: {
      color: "#143423",
      pattern: { type: "stripes", color: "rgba(255, 255, 255, 0.05)", width: 8, gap: 38 },
    },
    inkStrong: "#f6ead7",
    inkSoft: "rgba(246, 234, 215, 0.6)",
    ornaments: [
      { src: "/ornaments/star.svg", cx: 0.08, cy: 0.035, size: 0.08, rotate: -10 },
      { src: "/ornaments/star.svg", cx: 0.92, cy: 0.04, size: 0.06, rotate: 18 },
      { src: "/ornaments/star.svg", cx: 0.86, cy: 0.955, size: 0.05, rotate: -22 },
    ],
  },
};

/** Lookup dengan fallback: sesi lama (mis. 'strip3') dianggap layout klasik. */
export function templateById(value: string): TemplateDef {
  if ((TEMPLATE_IDS as readonly string[]).includes(value)) {
    return TEMPLATE_DEFS[value as TemplateId];
  }
  return TEMPLATE_DEFS.classic;
}
