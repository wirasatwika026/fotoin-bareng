import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Bucket harus sudah ada (provisioning infra, bukan urusan aplikasi).
const BUCKET = process.env.S3_BUCKET ?? "fotoin";

const globalStore = globalThis as unknown as {
  _fotoinS3?: S3Client;
  _fotoinS3Key?: string;
};

function s3(): S3Client {
  // Cache di-key dari env supaya reload .env.local saat dev tidak memakai client basi.
  const cacheKey = `${process.env.S3_ENDPOINT}|${process.env.S3_ACCESS_KEY}`;
  if (!globalStore._fotoinS3 || globalStore._fotoinS3Key !== cacheKey) {
    globalStore._fotoinS3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true, // MinIO memakai path-style, bukan virtual-host
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
    globalStore._fotoinS3Key = cacheKey;
  }
  return globalStore._fotoinS3;
}

export async function putPhoto(key: string, body: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getPhoto(
  key: string
): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      stream: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "image/jpeg",
    };
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}
