import Link from "next/link";

export default function SessionNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-booth px-6 text-center">
      <h1 className="font-display text-2xl font-black text-paper">
        Sesi tidak ditemukan
      </h1>
      <p className="max-w-sm text-sm text-paper/70">
        Kodenya mungkin salah ketik, sesinya belum dibuat, atau sudah
        kedaluwarsa (sesi tersimpan 30 hari). Cek lagi link dari temanmu ya.
      </p>
      <Link
        href="/"
        className="rounded-full bg-flash px-6 py-3 font-display text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
      >
        BIKIN PHOTOBOX BARU
      </Link>
    </div>
  );
}
