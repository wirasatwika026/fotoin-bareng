import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans, Unbounded } from "next/font/google";
import "./globals.css";

const display = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: "Fotoin Bareng — photobox virtual buat berdua",
  description:
    "Bikin strip photobox bareng orang jauh. Satu bikin sesi, satu lagi nyusul lewat link. 3..2..1.. cekrek!",
  openGraph: {
    siteName: "Fotoin Bareng",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
