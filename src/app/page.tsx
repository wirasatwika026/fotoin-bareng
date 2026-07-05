import Link from "next/link";
import { joinSessionAction } from "@/lib/actions";
import { TEMPLATE_DEFS } from "@/lib/templates";
import StripPreview from "./strip-preview";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const wrongCode = (await searchParams)["salah-kode"] !== undefined;

  return (
    <div className="bg-curtain-folds flex min-h-dvh flex-col">
      <header className="px-6 py-5 sm:px-10">
        <p className="font-display text-sm font-bold tracking-[0.25em] text-paper">
          FOTOIN BARENG
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-6 py-12 sm:px-10 lg:flex-row lg:gap-20">
        <div className="max-w-xl text-center lg:text-left">
          <p className="mb-4 inline-block rounded-full border border-paper/30 px-3 py-1 text-xs font-semibold tracking-widest text-paper/80">
            PHOTOBOX VIRTUAL
          </p>
          <h1 className="font-display text-3xl font-black leading-tight text-paper sm:text-5xl">
            Photobox bareng,
            <br />
            walau nggak bareng.
          </h1>
          <p className="mt-5 text-base text-paper/85 sm:text-lg">
            Kamu foto duluan, dia nyusul lewat link — kapan pun sempat. Pilih
            template, ambil pose, satu strip berdua langsung jadi.
          </p>

          <div className="mt-8">
            <Link
              href="/baru"
              className="inline-block rounded-full bg-flash px-8 py-4 font-display text-sm font-bold tracking-wider text-ink shadow-[0_10px_30px_-8px_rgb(0_0_0/0.5)] transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
            >
              BIKIN PHOTOBOX
            </Link>
          </div>

          <form
            action={joinSessionAction}
            className="mt-6 flex items-center justify-center gap-2 lg:justify-start"
          >
            <label htmlFor="code" className="text-sm text-paper/70">
              Punya kode?
            </label>
            <input
              id="code"
              name="code"
              placeholder="mis. k7mwp2ax"
              autoComplete="off"
              className="w-36 rounded-md border border-paper/30 bg-black/20 px-3 py-2 font-mono text-sm text-paper placeholder:text-paper/40 focus:border-flash focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-paper/40 px-4 py-2 text-sm font-semibold text-paper transition hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              Masuk
            </button>
          </form>
          {wrongCode && (
            <p className="mt-2 text-sm text-flash">
              Kode terdiri dari 4–16 huruf/angka. Cek lagi ya.
            </p>
          )}
        </div>

        <div className="w-52 rotate-3 sm:w-60">
          <StripPreview
            def={TEMPLATE_DEFS.couple}
            className="w-full rounded-sm shadow-[0_24px_60px_-12px_rgb(0_0_0/0.55)]"
          />
        </div>
      </main>

      <section className="border-t border-black/20 bg-black/15 px-6 py-8 sm:px-10">
        <ol className="mx-auto flex max-w-4xl flex-col gap-6 text-sm text-paper/85 sm:flex-row sm:justify-between">
          <li className="flex-1">
            <span className="font-display font-bold text-flash">1 · Bikin</span>
            <p className="mt-1">Pilih template, ambil posemu duluan.</p>
          </li>
          <li className="flex-1">
            <span className="font-display font-bold text-flash">2 · Bagikan</span>
            <p className="mt-1">Kirim link ke dia — dibuka kapan saja.</p>
          </li>
          <li className="flex-1">
            <span className="font-display font-bold text-flash">3 · Cekrek</span>
            <p className="mt-1">Dia isi sisinya, strip kalian jadi. Unduh & pajang.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
