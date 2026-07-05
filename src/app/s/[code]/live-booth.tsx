"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { captureVideoFrame, getCameraStream } from "@/lib/camera";
import { type Side } from "@/lib/config";
import { photoAspect } from "@/lib/strip";
import { templateById, type TemplateId } from "@/lib/templates";
import PhotoBooth from "./photo-booth";
import SharePanel from "./share-panel";

type LivePhase =
  | "idle" // belum menyalakan kamera
  | "waiting" // di room, pasangan belum datang
  | "connecting" // pasangan datang, WebRTC sedang tersambung
  | "ready" // saling lihat, siap countdown
  | "counting"
  | "review"
  | "sending"
  | "waiting-partner" // fotoku terkirim, menunggu kiriman dia
  | "peer-lost"
  | "full" // room sudah berisi 2 orang lain
  | "fallback"; // beralih ke alur async

type Shot = { blob: Blob; url: string };
type SyncMessage =
  | { type: "pose"; index: number }
  | { type: "shot"; index: number; dataUrl: string }
  | { type: "uploaded" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SILHOUETTE = "/silhouette.svg";

/** Versi kecil foto untuk dikirim ke pasangan lewat DataChannel (review). */
async function makePreviewDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const width = Math.min(320, bitmap.width);
  const height = Math.round((bitmap.height / bitmap.width) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

export default function LiveBooth({
  code,
  side,
  template,
  partnerKeys,
}: {
  code: string;
  side: Side;
  template: TemplateId;
  /** Foto sisi A yang sudah ada — untuk fallback async sisi B. */
  partnerKeys?: string[];
}) {
  const def = templateById(template);
  const aspect = photoAspect(def);
  const router = useRouter();
  const isA = side === "a";

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const shotsRef = useRef<Shot[]>([]);
  const peerUploadedRef = useRef(false);

  const [phase, setPhase] = useState<LivePhase>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [shotNumber, setShotNumber] = useState(0);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  // Preview foto pasangan per pose (dikirim P2P lewat DataChannel).
  const [partnerShots, setPartnerShots] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  function teardown() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  }

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      teardown();
    };
  }, []);

  // Selagi menunggu kiriman pasangan, refresh berkala — server akan
  // menampilkan strip begitu kedua sisi terisi.
  useEffect(() => {
    if (phase !== "waiting-partner") return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [phase, router]);

  // Elemen <video> di-mount/unmount mengikuti fase, sedangkan stream hidup
  // lebih lama — pasang ulang setiap ganti fase supaya tidak black screen.
  useEffect(() => {
    const local = localVideoRef.current;
    if (local && streamRef.current && local.srcObject !== streamRef.current) {
      local.srcObject = streamRef.current;
      local.play().catch(() => {});
    }
    const remote = remoteVideoRef.current;
    if (remote && remoteStreamRef.current && remote.srcObject !== remoteStreamRef.current) {
      remote.srcObject = remoteStreamRef.current;
      remote.play().catch(() => {});
    }
  }, [phase]);

  function sendWs(payload: object) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  function sendSync(msg: SyncMessage) {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(msg));
  }

  async function begin() {
    setError(null);
    try {
      const stream = await getCameraStream();
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
    } catch {
      setError("Kamera tidak bisa diakses. Kamu bisa lanjut lewat mode gantian.");
      return;
    }
    connectSignaling();
  }

  function connectSignaling() {
    const url = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:3001";
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => sendWs({ type: "join", room: code });
    ws.onerror = () => {
      if (!cancelledRef.current) {
        setError("Tidak bisa terhubung ke server live. Coba lagi, atau lanjut mode gantian.");
      }
    };
    ws.onmessage = async (event) => {
      let msg: { type: string; count?: number; data?: SignalData };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.type === "full") {
        setPhase("full");
        teardown();
      } else if (msg.type === "peers") {
        if (msg.count === 1) setPhase("waiting");
        else await startPeer();
      } else if (msg.type === "peer-joined") {
        await startPeer();
      } else if (msg.type === "signal" && msg.data) {
        await handleSignal(msg.data);
      } else if (msg.type === "peer-left") {
        handlePeerLeft();
      }
    };
  }

  type SignalData = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

  async function startPeer() {
    if (pcRef.current || !streamRef.current) return;
    setPhase("connecting");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;
    streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) sendWs({ type: "signal", data: { ice: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      if (!e.streams[0]) return;
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        handlePeerLeft();
      }
    };

    // Deterministik: pembuat sesi (sisi A) yang membuat offer & data channel.
    if (isA) {
      setupSyncChannel(pc.createDataChannel("sync"));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWs({ type: "signal", data: { sdp: offer } });
    } else {
      pc.ondatachannel = (e) => setupSyncChannel(e.channel);
    }
  }

  function setupSyncChannel(dc: RTCDataChannel) {
    dcRef.current = dc;
    dc.onopen = () => {
      if (!cancelledRef.current) setPhase("ready");
    };
    dc.onmessage = (e) => {
      let msg: SyncMessage;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.type === "pose") {
        startedRef.current = true;
        void runPose(msg.index);
      } else if (msg.type === "shot") {
        setPartnerShots((prev) => ({ ...prev, [msg.index]: msg.dataUrl }));
      } else if (msg.type === "uploaded") {
        peerUploadedRef.current = true;
        router.refresh();
      }
    };
  }

  async function handleSignal(data: SignalData) {
    if (!pcRef.current) await startPeer();
    const pc = pcRef.current;
    if (!pc) return;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWs({ type: "signal", data: { sdp: answer } });
        }
      } else if (data.ice) {
        await pc.addIceCandidate(data.ice);
      }
    } catch {
      // Sinyal ganda/terlambat tidak fatal — koneksi tetap diusahakan.
    }
  }

  function handlePeerLeft() {
    if (cancelledRef.current) return;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setPhase((current) => {
      // Begitu sudah masuk review, video call tidak dibutuhkan lagi — pasangan
      // yang lebih dulu kirim akan menutup koneksinya secara normal, dan itu
      // bukan error bagi sisi yang belum kirim.
      if (
        current === "review" ||
        current === "sending" ||
        current === "waiting-partner" ||
        current === "fallback"
      ) {
        return current;
      }
      return "peer-lost";
    });
  }

  async function runPose(index: number) {
    if (cancelledRef.current) return;
    setPhase("counting");
    setShotNumber(index);
    for (let c = 3; c >= 1; c--) {
      setCount(c);
      await sleep(900);
      if (cancelledRef.current) return;
    }
    setCount(null);
    try {
      const video = localVideoRef.current;
      if (!video) throw new Error("Kamera belum siap");
      const blob = await captureVideoFrame(video, aspect);
      const next = [...shotsRef.current];
      next[index - 1] = { blob, url: URL.createObjectURL(blob) };
      shotsRef.current = next;
      setShots(next);
      // Bagikan preview kecil ke pasangan supaya review dia menampilkan
      // foto asli, bukan siluet. Gagal kirim tidak fatal.
      makePreviewDataUrl(blob)
        .then((dataUrl) => sendSync({ type: "shot", index, dataUrl }))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil foto");
    }
    setFlash(true);
    await sleep(450);
    setFlash(false);
    if (shotsRef.current.filter(Boolean).length >= def.shots) {
      setPhase("review");
    }
  }

  async function startAll() {
    if (startedRef.current) return;
    startedRef.current = true;
    for (let i = 1; i <= def.shots; i++) {
      sendSync({ type: "pose", index: i });
      await runPose(i);
      if (cancelledRef.current) return;
      if (i < def.shots) await sleep(700);
    }
  }

  async function retakePose(index: number) {
    // Ulang pose sendiri saja — separuh dia tidak terpengaruh.
    await runPose(index + 1);
    setPhase("review");
  }

  async function send() {
    setPhase("sending");
    setError(null);
    const form = new FormData();
    form.set("side", side);
    shotsRef.current.forEach((s, i) => form.append("photos", s.blob, `pose-${i + 1}.jpg`));
    try {
      const res = await fetch(`/api/sessions/${code}/photos`, { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Gagal mengirim foto");
      }
      sendSync({ type: "uploaded" });
      setPhase("waiting-partner");
      if (peerUploadedRef.current) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim foto");
      setPhase("review");
    }
  }

  function goFallback() {
    teardown();
    setPhase("fallback");
  }

  if (phase === "fallback") {
    return (
      <PhotoBooth
        code={code}
        side={side}
        template={template}
        partnerKeys={side === "b" ? partnerKeys : undefined}
      />
    );
  }

  const inCall = phase === "ready" || phase === "counting";
  const showMedia =
    phase === "waiting" || phase === "connecting" || inCall;

  const localVideo = (
    <video
      ref={localVideoRef}
      playsInline
      muted
      style={{ aspectRatio: aspect }}
      className="w-full -scale-x-100 object-cover"
    />
  );
  const remoteVideo = (
    <video
      ref={remoteVideoRef}
      playsInline
      style={{ aspectRatio: aspect }}
      className={`w-full -scale-x-100 object-cover ${inCall ? "" : "hidden"}`}
    />
  );

  return (
    <div className={`w-full ${inCall || phase === "review" || phase === "sending" ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="relative overflow-hidden rounded-xl bg-black/60 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.7)]">
        {phase === "idle" && (
          <div className="flex aspect-4/3 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-paper/70">
              Kalian akan saling lihat lewat video, lalu countdown bareng —
              video-nya langsung antar browser, tidak direkam server.
            </p>
            <button
              onClick={begin}
              className="rounded-full bg-flash px-6 py-3 font-display text-sm font-bold text-ink transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              GABUNG BILIK LIVE
            </button>
          </div>
        )}

        {showMedia && (
          <div className={inCall ? (def.joined ? "grid grid-cols-2" : "grid grid-cols-2 gap-1") : ""}>
            {isA ? (
              <>
                <div className="relative">{localVideo}</div>
                {remoteVideo}
              </>
            ) : (
              <>
                {remoteVideo}
                <div className="relative">{localVideo}</div>
              </>
            )}
          </div>
        )}

        {(phase === "review" || phase === "sending") && (
          <div className="flex flex-col items-center gap-4 p-6">
            <div
              className={`grid w-full gap-2 ${(def.columns ?? 1) > 1 ? "max-w-xl" : "max-w-md"}`}
              style={{ gridTemplateColumns: `repeat(${def.columns ?? 1}, 1fr)` }}
            >
              {shots.map((s, i) => {
                const ownThumb = (
                  <span className="relative w-1/2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.url}
                      alt={`Pose ${i + 1}`}
                      style={{ aspectRatio: aspect }}
                      className="w-full object-cover"
                    />
                    {phase === "review" && (
                      <button
                        type="button"
                        onClick={() => retakePose(i)}
                        aria-label={`Ulangi pose ${i + 1}`}
                        title={`Ulangi pose ${i + 1}`}
                        className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-paper backdrop-blur transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-flash"
                      >
                        ↺
                      </button>
                    )}
                  </span>
                );
                const partnerThumb = (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={partnerShots[i + 1] ?? SILHOUETTE}
                    alt={partnerShots[i + 1] ? `Pose pasanganmu ${i + 1}` : "Sisi pasanganmu"}
                    style={{ aspectRatio: aspect }}
                    className={`w-1/2 object-cover ${partnerShots[i + 1] ? "" : "opacity-80"}`}
                  />
                );
                return (
                  <div key={s.url} className={`flex ${def.joined ? "" : "gap-1"}`}>
                    {isA ? ownThumb : partnerThumb}
                    {isA ? partnerThumb : ownThumb}
                  </div>
                );
              })}
            </div>
            <button
              onClick={send}
              disabled={phase === "sending"}
              className="rounded-full bg-flash px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              {phase === "sending" ? "Ngirim…" : "Pakai & kirim"}
            </button>
            <p className="text-xs text-paper/50">
              Dia juga kirim sisinya sendiri — strip jadi begitu dua-duanya masuk.
            </p>
          </div>
        )}

        {phase === "waiting-partner" && (
          <div className="flex aspect-4/3 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="animate-pulse text-sm text-paper/80">
              Fotomu terkirim. Nunggu dia ngirim sisinya…
            </p>
          </div>
        )}

        {phase === "peer-lost" && (
          <div className="flex aspect-4/3 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-paper/80">
              Koneksi dengan pasanganmu terputus.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  setPhase(wsRef.current?.readyState === WebSocket.OPEN ? "waiting" : "idle");
                  if (wsRef.current?.readyState !== WebSocket.OPEN) teardown();
                }}
                className="rounded-full border border-paper/40 px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Tunggu dia balik
              </button>
              <button
                onClick={goFallback}
                className="rounded-full bg-flash px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Lanjut tanpa dia (gantian)
              </button>
            </div>
          </div>
        )}

        {phase === "full" && (
          <div className="flex aspect-4/3 items-center justify-center p-8 text-center">
            <p className="text-sm text-paper/80">
              Bilik ini sudah terisi dua orang. Kalau itu kamu di perangkat
              lain, tutup salah satunya dulu.
            </p>
          </div>
        )}

        {phase === "counting" && count !== null && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <p className="font-display text-8xl font-black text-flash drop-shadow-lg">{count}</p>
            <p className="mt-2 text-sm font-semibold tracking-widest text-paper">
              POSE {shotNumber}/{def.shots}
            </p>
          </div>
        )}

        {flash && <div className="animate-flash pointer-events-none absolute inset-0 bg-white" />}
      </div>

      {phase === "waiting" && (
        <div className="mt-5 flex flex-col items-center gap-4">
          <p className="text-sm text-paper/70">Nunggu dia gabung…</p>
          <SharePanel code={code} />
        </div>
      )}

      {phase === "connecting" && (
        <p className="mt-5 animate-pulse text-center text-sm text-paper/70">
          Dia datang! Menghubungkan video…
        </p>
      )}

      {phase === "ready" && (
        <div className="mt-5 text-center">
          <button
            onClick={startAll}
            className="rounded-full bg-flash px-8 py-4 font-display text-sm font-bold tracking-wider text-ink shadow-lg transition hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          >
            MULAI — {def.shots} POSE
          </button>
          <p className="mt-3 text-xs text-paper/60">
            Siapa pun boleh mulai. Countdown jalan serentak di dua layar —
            yang tampil di bingkai = persis yang tercetak.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-flash">{error}</p>
          <button
            onClick={goFallback}
            className="mt-2 text-sm text-paper/60 underline underline-offset-4 transition hover:text-paper"
          >
            Lanjut mode gantian saja
          </button>
        </div>
      )}
    </div>
  );
}
