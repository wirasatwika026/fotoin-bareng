"use client";

import { useFormStatus } from "react-dom";

export default function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-flash px-8 py-4 font-display text-sm font-bold tracking-wider text-ink shadow-[0_10px_30px_-8px_rgb(0_0_0/0.5)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
    >
      {pending ? "NYIAPIN BILIK…" : "BIKIN PHOTOBOX"}
    </button>
  );
}
