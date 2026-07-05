import { readFileSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan lewat: npm run db:setup");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
await sql.unsafe(readFileSync("db/schema.sql", "utf8"));
await sql.end();
console.log("Skema database diterapkan.");
