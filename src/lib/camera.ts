// Capture frame dari <video> kamera lokal — dipakai booth async & live.

/**
 * Cover-crop frame video ke rasio slot template, di-mirror agar sama dengan
 * preview. Resolusi sisi terpanjang 800px (cukup untuk cetak strip).
 */
export function captureVideoFrame(video: HTMLVideoElement, aspect: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = aspect >= 1 ? 800 : Math.round(800 * aspect);
    canvas.height = aspect >= 1 ? Math.round(800 / aspect) : 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas tidak tersedia"));

    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const sw = canvas.width / scale;
    const sh = canvas.height / scale;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengambil foto"))),
      "image/jpeg",
      0.92
    );
  });
}

/** Kamera depan dengan resolusi cukup untuk capture 800px. */
export function getCameraStream(audio = false): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
  });
}
