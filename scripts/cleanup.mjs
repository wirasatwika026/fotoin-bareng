// Menghapus sesi kedaluwarsa: semua objek foto di MinIO lalu baris DB-nya.
// Jalankan manual (npm run db:cleanup) atau nanti sebagai CronJob k8s.
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan lewat: npm run db:cleanup");
  process.exit(1);
}

const BUCKET = process.env.S3_BUCKET ?? "fotoin";
const sql = postgres(process.env.DATABASE_URL);
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

const expired = await sql`select code from sessions where expires_at <= now()`;
console.log(`Sesi kedaluwarsa: ${expired.length}`);

for (const { code } of expired) {
  // Hapus SEMUA objek di prefix sesi — termasuk foto yatim sisa retake.
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `sessions/${code}/` })
  );
  const objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key }));
  if (objects.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } })
    );
  }
  await sql`delete from sessions where code = ${code}`;
  console.log(`  ${code}: ${objects.length} objek dihapus`);
}

await sql.end();
console.log("Selesai.");
