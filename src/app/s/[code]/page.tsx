import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retakePhotosAction } from "@/lib/actions";
import { getSession } from "@/lib/sessions";
import { templateById } from "@/lib/templates";
import LiveBooth from "./live-booth";
import PhotoBooth from "./photo-booth";
import ResultStrip from "./result-strip";
import SharePanel from "./share-panel";
import WaitingPoll from "./waiting-poll";

export async function generateMetadata(
  props: PageProps<"/s/[code]">
): Promise<Metadata> {
  const { code } = await props.params;
  const session = await getSession(code);
  if (!session) {
    return { title: "Sesi tidak ditemukan — Fotoin Bareng" };
  }
  const done = session.photoAKeys.length > 0 && session.photoBKeys.length > 0;
  const title = done
    ? "Strip photobox kalian sudah jadi! — Fotoin Bareng"
    : "Kamu diajak fotoin bareng! 📸";
  const description = done
    ? "Buka buat lihat dan unduh strip photobox kalian."
    : "Buka link-nya, ambil posemu, dan strip photobox kalian langsung jadi.";
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function SessionPage(props: PageProps<"/s/[code]">) {
  const { code } = await props.params;
  const session = await getSession(code);
  if (!session) notFound();

  const jar = await cookies();
  const role = jar.get(`fotoin-role-${code}`)?.value === "a" ? "a" : "b";
  const def = templateById(session.template);
  const aDone = session.photoAKeys.length > 0;
  const bDone = session.photoBKeys.length > 0;

  let heading: string;
  let sub: string;
  let content: React.ReactNode;

  if (aDone && bDone) {
    heading = "Cekrek! Strip kalian jadi.";
    sub = "Simpan, cetak, atau kirim balik ke dia.";
    content = (
      <ResultStrip
        code={code}
        template={def.id}
        photoAKeys={session.photoAKeys}
        photoBKeys={session.photoBKeys}
        createdAtISO={session.createdAt.toISOString()}
      />
    );
  } else if (session.mode === "live") {
    const myDone = role === "a" ? aDone : bDone;
    if (myDone) {
      heading = "Fotomu terkirim.";
      sub = "Tinggal nunggu sisinya dia. Halaman ini bakal update sendiri.";
      content = (
        <>
          <SharePanel code={code} />
          <WaitingPoll />
        </>
      );
    } else {
      heading = "Bilik live.";
      sub =
        role === "a"
          ? "Ajak dia masuk, kalian saling lihat, lalu countdown bareng."
          : "Kamu diajak foto bareng langsung — nyalakan kamera dan gabung.";
      content = (
        <LiveBooth
          code={code}
          side={role}
          template={def.id}
          partnerKeys={role === "b" && aDone ? session.photoAKeys : undefined}
        />
      );
    }
  } else if (role === "a" && !aDone) {
    heading = "Giliranmu duluan.";
    sub = `${def.shots} pose, hitung mundur tiap pose. Jangan kedip.`;
    content = <PhotoBooth code={code} side="a" template={def.id} />;
  } else if (role === "b" && !aDone) {
    heading = "Sabar dulu…";
    sub = "Yang bikin sesi belum ambil foto. Halaman ini bakal update sendiri.";
    content = <WaitingPoll />;
  } else if (role === "b") {
    heading = "Giliranmu!";
    sub = def.joined
      ? "Dia sudah foto duluan. Fotonya tampil di sampingmu — samain gayanya biar nyatu."
      : "Dia sudah foto duluan. Isi sisi kananmu.";
    content = (
      <PhotoBooth
        code={code}
        side="b"
        template={def.id}
        partnerKeys={session.photoAKeys}
      />
    );
  } else {
    heading = "Stripmu setengah jadi.";
    sub = "Tinggal nunggu dia ngisi sisinya. Halaman ini bakal update sendiri.";
    content = (
      <>
        <SharePanel code={code} />
        <form action={retakePhotosAction.bind(null, code)}>
          <button
            type="submit"
            className="text-sm text-paper/60 underline underline-offset-4 transition hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            Kurang sreg? Ulangi fotoku
          </button>
        </form>
        <WaitingPoll />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-booth">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="font-display text-sm font-bold tracking-[0.25em] text-paper transition hover:text-flash focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        >
          FOTOIN BARENG
        </Link>
        <span className="font-mono text-xs tracking-widest text-paper/50">{code}</span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
        <div className="text-center">
          <h1 className="font-display text-2xl font-black text-paper sm:text-3xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-paper/70">{sub}</p>
        </div>
        {content}
      </main>
    </div>
  );
}
