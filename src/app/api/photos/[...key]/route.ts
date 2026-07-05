import { getPhoto } from "@/lib/storage";

// Hanya izinkan pola key foto sesi, bukan objek MinIO sembarangan.
// Nonce opsional demi kompatibilitas dengan key lama (tanpa nonce).
const KEY_PATTERN = /^sessions\/[a-z0-9]{4,16}\/[ab]-(?:[a-z0-9]{4,12}-)?[1-9]\.(jpg|png|webp)$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[...key]">) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  if (!KEY_PATTERN.test(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  const photo = await getPhoto(objectKey);
  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(photo.stream, {
    headers: {
      "Content-Type": photo.contentType,
      // Foto tidak pernah berubah setelah terisi (tidak ada retake pasca-upload).
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
