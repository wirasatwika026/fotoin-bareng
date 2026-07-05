import { customAlphabet } from "nanoid";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { MAX_PHOTO_BYTES, type Side } from "@/lib/config";
import { getSession, savePhotos } from "@/lib/sessions";
import { putPhoto } from "@/lib/storage";
import { templateById } from "@/lib/templates";

// Nonce di key membuat retake menghasilkan URL baru (aman dari cache immutable).
const makeNonce = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/sessions/[code]/photos">
) {
  const { code } = await ctx.params;

  const session = await getSession(code);
  if (!session) {
    return Response.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  }
  const template = templateById(session.template);

  const form = await req.formData();
  const side = form.get("side");
  if (side !== "a" && side !== "b") {
    return Response.json({ error: "Sisi tidak valid" }, { status: 400 });
  }

  // Aturan giliran & kepemilikan sisi:
  // - Sisi A hanya boleh diisi pembuat sesi (pemegang cookie role=a).
  // - Sisi B boleh diisi pemegang link mana pun KECUALI si pembuat sendiri,
  //   dan baru setelah sisi A terisi (async: A selalu duluan).
  const jar = await cookies();
  const role = jar.get(`fotoin-role-${code}`)?.value;
  if (side === "a" && role !== "a") {
    return Response.json(
      { error: "Hanya pembuat sesi yang bisa mengisi sisi ini" },
      { status: 403 }
    );
  }
  if (side === "b" && role === "a") {
    return Response.json(
      { error: "Kamu pembuat sesi — sisi ini buat pasanganmu" },
      { status: 403 }
    );
  }
  // Di mode live keduanya upload hampir bersamaan — urutan giliran hanya
  // berlaku untuk mode async.
  if (side === "b" && session.mode !== "live" && session.photoAKeys.length === 0) {
    return Response.json(
      { error: "Pembuat sesi belum ambil foto — giliranmu setelah dia" },
      { status: 409 }
    );
  }

  const files = form.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length !== template.shots) {
    return Response.json(
      { error: `Butuh tepat ${template.shots} foto` },
      { status: 400 }
    );
  }
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return Response.json({ error: "Format foto harus JPEG/PNG/WebP" }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Ukuran foto maksimal 8 MB" }, { status: 400 });
    }
  }

  const alreadyFilled =
    side === "a" ? session.photoAKeys.length > 0 : session.photoBKeys.length > 0;
  if (alreadyFilled) {
    return Response.json({ error: "Slot foto sisi ini sudah terisi" }, { status: 409 });
  }

  const ext = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg");
  const nonce = makeNonce();
  const keys = files.map((f, i) => `sessions/${code}/${side}-${nonce}-${i + 1}.${ext(f.type)}`);
  await Promise.all(
    files.map(async (file, i) =>
      putPhoto(keys[i], new Uint8Array(await file.arrayBuffer()), file.type)
    )
  );

  const updated = await savePhotos(code, side as Side, keys);
  if (!updated) {
    return Response.json({ error: "Slot foto sisi ini sudah terisi" }, { status: 409 });
  }

  // Claim: pengisi sisi ini dikenali lagi di kunjungan berikutnya.
  jar.set(`fotoin-role-${code}`, side, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });
  return Response.json({ ok: true });
}
