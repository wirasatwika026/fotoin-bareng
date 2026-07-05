import { customAlphabet } from "nanoid";
import { db } from "./db";
import type { SessionMode, Side } from "./config";
import type { TemplateId } from "./templates";

// Tanpa karakter ambigu (0/o, 1/l/i) supaya kode enak dibaca & diketik.
const makeCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);

export type PhotoSession = {
  code: string;
  template: string;
  mode: SessionMode;
  photoAKeys: string[];
  photoBKeys: string[];
  createdAt: Date;
};

type SessionRow = {
  code: string;
  template: string;
  mode: string;
  photo_a_keys: string[];
  photo_b_keys: string[];
  created_at: Date;
};

function rowToSession(row: SessionRow): PhotoSession {
  return {
    code: row.code,
    template: row.template,
    mode: row.mode === "live" ? "live" : "async",
    photoAKeys: row.photo_a_keys,
    photoBKeys: row.photo_b_keys,
    createdAt: row.created_at,
  };
}

export async function createSession(
  template: TemplateId,
  mode: SessionMode
): Promise<PhotoSession> {
  const sql = db();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    try {
      const rows = await sql<SessionRow[]>`
        insert into sessions (code, template, mode)
        values (${code}, ${template}, ${mode}) returning *`;
      return rowToSession(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") continue; // tabrakan kode, coba lagi
      throw err;
    }
  }
  throw new Error("Gagal membuat kode sesi unik");
}

export async function getSession(code: string): Promise<PhotoSession | null> {
  const sql = db();
  // Sesi kedaluwarsa diperlakukan seperti tidak ada — semua jalur (halaman,
  // upload, retake) otomatis menolaknya lewat satu pintu ini.
  const rows = await sql<SessionRow[]>`
    select * from sessions where code = ${code} and expires_at > now() limit 1`;
  return rows[0] ? rowToSession(rows[0]) : null;
}

/**
 * Mengisi slot foto satu sisi. Hanya berhasil jika slot masih kosong
 * (guard di SQL, aman dari dua upload bersamaan). Mengembalikan sesi
 * terbaru, atau null jika slot sudah terisi.
 */
export async function savePhotos(
  code: string,
  side: Side,
  keys: string[]
): Promise<PhotoSession | null> {
  const sql = db();
  const column = side === "a" ? "photo_a_keys" : "photo_b_keys";
  const rows = await sql<SessionRow[]>`
    update sessions
    set ${sql(column)} = ${keys}::text[], updated_at = now()
    where code = ${code} and cardinality(${sql(column)}) = 0
    returning *`;
  return rows[0] ? rowToSession(rows[0]) : null;
}

/**
 * Mengosongkan foto sisi A untuk retake. Hanya boleh selama sisi B belum
 * mengisi (setelah strip lengkap, hasil dianggap final).
 */
export async function clearPhotosA(code: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update sessions
    set photo_a_keys = '{}', updated_at = now()
    where code = ${code}
      and cardinality(photo_b_keys) = 0
      and cardinality(photo_a_keys) > 0
    returning code`;
  return rows.length > 0;
}
