// Batas ukuran per file foto yang di-upload.
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type Side = "a" | "b";

// "async" = gantian lewat link; "live" = online bareng, countdown serentak.
export type SessionMode = "async" | "live";
