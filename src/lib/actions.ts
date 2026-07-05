"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearPhotosA, createSession } from "./sessions";
import { TEMPLATE_IDS, type TemplateId } from "./templates";

export async function createSessionAction(formData: FormData) {
  const raw = String(formData.get("template") ?? "");
  const template: TemplateId = (TEMPLATE_IDS as readonly string[]).includes(raw)
    ? (raw as TemplateId)
    : "couple";
  const mode = formData.get("mode") === "live" ? "live" : "async";
  const session = await createSession(template, mode);
  const jar = await cookies();
  // Penanda "kamu yang bikin sesi ini" — pembuat mengisi sisi A duluan.
  jar.set(`fotoin-role-${session.code}`, "a", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });
  redirect(`/s/${session.code}`);
}

export async function joinSessionAction(formData: FormData) {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(code)) {
    redirect("/?salah-kode=1");
  }
  redirect(`/s/${code}`);
}

export async function retakePhotosAction(code: string) {
  const jar = await cookies();
  // Hanya pembuat sesi (sisi A) yang boleh mengulang fotonya.
  if (jar.get(`fotoin-role-${code}`)?.value !== "a") return;
  await clearPhotosA(code);
  refresh();
}
