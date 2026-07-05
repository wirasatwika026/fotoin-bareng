import type { Metadata } from "next";
import Link from "next/link";
import { createSessionAction } from "@/lib/actions";
import { CATEGORIES, TEMPLATE_DEFS } from "@/lib/templates";
import CreateButton from "../create-button";
import StripPreview from "../strip-preview";

export const metadata: Metadata = {
  title: "Pilih template — Fotoin Bareng",
  description: "Pilih gaya strip photobox kalian, lalu mulai foto.",
};

export default function NewSessionPage() {
  const defs = Object.values(TEMPLATE_DEFS);

  return (
    <div className="flex min-h-dvh flex-col bg-booth">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="font-display text-sm font-bold tracking-[0.25em] text-paper transition hover:text-flash focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        >
          FOTOIN BARENG
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-32 sm:px-10">
        <h1 className="font-display text-2xl font-black text-paper sm:text-3xl">
          Pilih gaya strip kalian
        </h1>
        <p className="mt-2 text-sm text-paper/70">
          Preview di bawah persis hasil akhirnya — tinggal ganti siluetnya jadi
          muka kalian.
        </p>

        <form action={createSessionAction}>
          <fieldset className="mt-8">
            <legend className="font-display text-sm font-bold tracking-[0.2em] text-flash">
              CARA FOTONYA
            </legend>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="cursor-pointer">
                <input type="radio" name="mode" value="async" defaultChecked className="peer sr-only" />
                <span className="block h-full rounded-xl border-2 border-paper/20 bg-black/20 p-4 transition peer-checked:border-flash peer-checked:bg-black/40 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper hover:border-paper/40">
                  <span className="block text-sm font-semibold text-paper">Gantian</span>
                  <span className="mt-1 block text-xs text-paper/60">
                    Kamu foto duluan, dia buka link kapan pun sempat.
                  </span>
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="mode" value="live" className="peer sr-only" />
                <span className="block h-full rounded-xl border-2 border-paper/20 bg-black/20 p-4 transition peer-checked:border-flash peer-checked:bg-black/40 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper hover:border-paper/40">
                  <span className="block text-sm font-semibold text-paper">
                    Bareng langsung{" "}
                    <span className="rounded bg-flash/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-flash">
                      LIVE
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-paper/60">
                    Kalian online bareng, saling lihat, countdown serentak — cekrek!
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {CATEGORIES.map((category) => (
            <section key={category} className="mt-10">
              <h2 className="font-display text-sm font-bold tracking-[0.2em] text-flash">
                {category.toUpperCase()}
              </h2>
              <div className="mt-4 grid grid-cols-2 items-start gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {defs
                  .filter((def) => def.category === category)
                  .map((def) => (
                    <label key={def.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name="template"
                        value={def.id}
                        defaultChecked={def.id === "couple"}
                        className="peer sr-only"
                      />
                      <span className="flex h-full flex-col gap-2 rounded-xl border-2 border-paper/20 bg-black/20 p-3 transition peer-checked:border-flash peer-checked:bg-black/40 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-paper hover:border-paper/40">
                        <StripPreview
                          def={def}
                          className="w-full rounded-sm shadow-[0_10px_25px_-8px_rgb(0_0_0/0.6)]"
                        />
                        <span className="mt-1 block text-sm font-semibold text-paper">
                          {def.label}
                        </span>
                        <span className="-mt-1 block text-xs text-paper/60">
                          {def.tagline}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </section>
          ))}

          <div className="fixed inset-x-0 bottom-0 border-t border-paper/10 bg-booth/90 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
              <p className="hidden text-xs text-paper/60 sm:block">
                Kamu foto duluan, dia nyusul lewat link.
              </p>
              <CreateButton />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
