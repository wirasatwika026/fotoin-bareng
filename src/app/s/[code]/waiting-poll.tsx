"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Menyegarkan data halaman secara berkala selagi menunggu sisi lain mengisi foto. */
export default function WaitingPoll() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
