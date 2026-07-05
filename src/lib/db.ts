import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

// Simpan koneksi di globalThis supaya tidak menumpuk saat HMR di dev.
const globalStore = globalThis as unknown as { _fotoinSql?: Sql };

export function db(): Sql {
  if (!globalStore._fotoinSql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL belum di-set — salin .env.example ke .env.local");
    }
    globalStore._fotoinSql = postgres(url, { onnotice: () => {} });
  }
  return globalStore._fotoinSql;
}
