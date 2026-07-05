"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { captureVideoFrame, getCameraStream } from "@/lib/camera";
import { type Side } from "@/lib/config";
import { photoAspect } from "@/lib/strip";
import { templateById, type TemplateId } from "@/lib/templates";

type Phase = "idle" | "live" | "counting" | "review" | "sending";
type Shot = { blob: Blob; url: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PhotoBooth({
  code,
  side,
  template,
  partnerKeys,
}: {
  code: string;
  side: Side;
  template: TemplateId;
  /** Foto pasangan (sisi A) — hanya diisi saat giliran sisi B. */
  partnerKeys?: string[];
}) {
  const def = templateById(template);
  // Rasio slot foto di template — preview, capture, dan thumbnail memakai
  // rasio yang sama supaya yang terlihat di layar = persis yang tercetak.
  const aspect = photoAspect(def);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [shotNumber, setShotNumber] = useState(0);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [ghost, setGhost] = useState(false);

  useEffect(() => {
    // Reset saat mount — Strict Mode di dev me-mount ulang komponen, dan tanpa
    // reset ini flag cancelled tetap true sehingga kamera langsung dimatikan.
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await getCameraStream();
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("live");
    } catch {
      setCameraFailed(true);
    }
  }

  function captureFrame(): Promise<Blob> {
    const video = videoRef.current;
    if (!video) return Promise.reject(new Error("Kamera belum siap"));
    return captureVideoFrame(video, aspect);
  }

  async function runShots() {
    setPhase("counting");
    setError(null);
    const taken: Shot[] = [];
    for (let i = 1; i <= def.shots; i++) {
      if (cancelledRef.current) return;
      setShotNumber(i);
      for (let c = 3; c >= 1; c--) {
        setCount(c);
        await sleep(900);
        if (cancelledRef.current) return;
      }
      setCount(null);
      try {
        const blob = await captureFrame();
        taken.push({ blob, url: URL.createObjectURL(blob) });
        setShots([...taken]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengambil foto");
        setPhase("live");
        return;
      }
      setFlash(true);
      await sleep(450);
      setFlash(false);
      if (i < def.shots) await sleep(600);
    }
    setPhase("review");
  }

  function retake() {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setError(null);
    setPhase(cameraFailed ? "idle" : "live");
  }

  /** Ulangi satu pose saja dari layar review (kamera masih menyala). */
  async function retakePose(index: number) {
    if (cameraFailed || !streamRef.current) return;
    setPhase("counting");
    setError(null);
    setShotNumber(index + 1);
    for (let c = 3; c >= 1; c--) {
      setCount(c);
      await sleep(900);
      if (cancelledRef.current) return;
    }
    setCount(null);
    try {
      const blob = await captureFrame();
      setShots((prev) => {
        const next = [...prev];
        URL.revokeObjectURL(next[index].url);
        next[index] = { blob, url: URL.createObjectURL(blob) };
        return next;
      });
      setFlash(true);
      await sleep(450);
      setFlash(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil foto");
    }
    setPhase("review");
  }

  /** Ganti satu pose dari galeri (mode fallback tanpa kamera). */
  function replaceFromFile(index: number, file: File | null | undefined) {
    if (!file) return;
    setShots((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next[index] = { blob: file, url: URL.createObjectURL(file) };
      return next;
    });
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).slice(0, def.shots);
    if (picked.length !== def.shots) {
      setError(`Pilih tepat ${def.shots} foto ya.`);
      return;
    }
    setError(null);
    setShots(picked.map((f) => ({ blob: f, url: URL.createObjectURL(f) })));
    setPhase("review");
  }

  async function send() {
    setPhase("sending");
    setError(null);
    const form = new FormData();
    form.set("side", side);
    shots.forEach((s, i) => form.append("photos", s.blob, `pose-${i + 1}.jpg`));
    try {
      const res = await fetch(`/api/sessions/${code}/photos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Gagal mengirim foto");
      }
      stopCamera();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim foto");
      setPhase("review");
    }
  }

  const isA = side === "a";
  const SILHOUETTE = "/silhouette.svg";
  const showVideo = !cameraFailed && phase !== "idle" && phase !== "review" && phase !== "sending";
  // Foto pasangan untuk pose yang sedang diambil (pose 1 sebelum mulai).
  const poseIndex = phase === "counting" ? Math.max(0, shotNumber - 1) : 0;
  const partnerSrc =
    partnerKeys && partnerKeys.length > 0
      ? `/api/photos/${partnerKeys[Math.min(poseIndex, partnerKeys.length - 1)]}`
      : null;
  // Sisi pasangan selalu ditampilkan: foto asli (giliran B) atau siluet
  // (giliran A) — supaya orang pertama pun tahu bentuk frame gabungannya.
  const splitView = showVideo && !ghost;
  const ghostView = showVideo && partnerSrc !== null && ghost;
  const reviewing = phase === "review" || phase === "sending";

  const partnerHalf = (
    <span className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={partnerSrc ?? SILHOUETTE}
        alt={partnerSrc ? `Pose pasanganmu ${poseIndex + 1}` : "Slot pasanganmu"}
        style={{ aspectRatio: aspect }}
        className="h-full w-full object-cover"
      />
      {!partnerSrc && (
        <span className="absolute inset-0 flex items-end justify-center pb-3 text-[10px] font-semibold tracking-widest text-paper/50">
          DIA NANTI DI SINI
        </span>
      )}
    </span>
  );

  return (
    <div className={`w-full ${splitView || reviewing ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="relative overflow-hidden rounded-xl bg-black/60 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.7)]">
        <div className={splitView ? (def.joined ? "grid grid-cols-2" : "grid grid-cols-2 gap-1") : ""}>
          {splitView && !isA && partnerHalf}
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ aspectRatio: aspect }}
              className={`w-full -scale-x-100 object-cover ${showVideo ? "" : "hidden"}`}
            />
            {ghostView && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={partnerSrc}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
              />
            )}
          </div>
          {splitView && isA && partnerHalf}
        </div>

        {showVideo && partnerSrc && (
          <button
            onClick={() => setGhost((g) => !g)}
            aria-pressed={ghost}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-paper backdrop-blur transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash"
          >
            {ghost ? "Ghost: nyala" : "Ghost: mati"}
          </button>
        )}

        {phase === "idle" && !cameraFailed && (
          <div className="flex aspect-4/3 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-paper/70">
              Kamera cuma dipakai buat ambil {def.shots} pose — nggak ada video
              yang dikirim ke mana-mana.
            </p>
            <button
              onClick={startCamera}
              className="rounded-full bg-flash px-6 py-3 font-display text-sm font-bold text-ink transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              NYALAKAN KAMERA
            </button>
          </div>
        )}

        {cameraFailed && phase !== "review" && phase !== "sending" && (
          <div className="flex aspect-4/3 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-paper/80">
              Kamera tidak bisa diakses. Kamu tetap bisa ikut — unggah{" "}
              {def.shots} foto dari galerimu.
            </p>
            <label className="cursor-pointer rounded-full bg-flash px-6 py-3 font-display text-sm font-bold text-ink transition hover:brightness-105 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-paper">
              PILIH {def.shots} FOTO
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>
          </div>
        )}

        {(phase === "review" || phase === "sending") && (
          <div className="flex flex-col items-center gap-4 p-6">
            <div
              className={`grid w-full gap-2 ${(def.columns ?? 1) > 1 ? "max-w-xl" : "max-w-md"}`}
              style={{ gridTemplateColumns: `repeat(${def.columns ?? 1}, 1fr)` }}
            >
              {shots.map((s, i) => {
                const retakeBadge =
                  phase === "review" &&
                  (cameraFailed ? (
                    <label
                      className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-paper backdrop-blur transition hover:bg-black/80 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-flash"
                      title={`Ganti pose ${i + 1}`}
                    >
                      ↺
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => replaceFromFile(i, e.target.files?.[0])}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => retakePose(i)}
                      aria-label={`Ulangi pose ${i + 1}`}
                      title={`Ulangi pose ${i + 1}`}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-paper backdrop-blur transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-flash"
                    >
                      ↺
                    </button>
                  ));

                const partnerThumb = (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={partnerKeys?.[i] ? `/api/photos/${partnerKeys[i]}` : SILHOUETTE}
                    alt={partnerKeys?.[i] ? `Pose pasanganmu ${i + 1}` : "Slot pasanganmu"}
                    style={{ aspectRatio: aspect }}
                    className="w-1/2 object-cover"
                  />
                );
                const ownThumb = (
                  <span className="relative w-1/2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.url}
                      alt={`Pose ${i + 1}`}
                      style={{ aspectRatio: aspect }}
                      className="w-full object-cover"
                    />
                    {retakeBadge}
                  </span>
                );

                // Susunan mengikuti strip: sisi A di kiri, sisi B di kanan.
                return (
                  <div key={s.url} className={`flex ${def.joined ? "" : "gap-1"}`}>
                    {isA ? ownThumb : partnerThumb}
                    {isA ? partnerThumb : ownThumb}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={retake}
                disabled={phase === "sending"}
                className="rounded-full border border-paper/40 px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-paper/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Ulangi semua
              </button>
              <button
                onClick={send}
                disabled={phase === "sending"}
                className="rounded-full bg-flash px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                {phase === "sending" ? "Ngirim…" : "Pakai & kirim"}
              </button>
            </div>
          </div>
        )}

        {phase === "counting" && count !== null && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <p className="font-display text-8xl font-black text-flash drop-shadow-lg">
              {count}
            </p>
            <p className="mt-2 text-sm font-semibold tracking-widest text-paper">
              POSE {shotNumber}/{def.shots}
            </p>
          </div>
        )}

        {flash && <div className="animate-flash pointer-events-none absolute inset-0 bg-white" />}
      </div>

      {phase === "live" && (
        <div className="mt-5 text-center">
          <button
            onClick={runShots}
            className="rounded-full bg-flash px-8 py-4 font-display text-sm font-bold tracking-wider text-ink shadow-lg transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          >
            MULAI — {def.shots} POSE
          </button>
          <p className="mt-3 text-xs text-paper/60">
            {partnerSrc
              ? "Foto pasanganmu tampil di kiri — samain gayanya biar nyambung!"
              : "Hitung mundur 3 detik tiap pose. Siap-siap gaya!"}{" "}
            Yang tampil di bingkai = persis yang tercetak, jadi pastikan kalian
            di dalam bingkai.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-flash">{error}</p>}
    </div>
  );
}
