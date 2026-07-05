import { ImageResponse } from "next/og";

export const alt = "Fotoin Bareng — photobox virtual buat berdua";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "64px 88px",
          background:
            "linear-gradient(100deg, #7a1220 0%, #a61b29 35%, #7a1220 70%, #a61b29 100%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 660 }}>
          <div style={{ fontSize: 26, letterSpacing: 12, color: "#ffc53d", fontWeight: 700 }}>
            FOTOIN BARENG
          </div>
          <div
            style={{
              fontSize: 64,
              color: "#faf5eb",
              fontWeight: 800,
              lineHeight: 1.15,
              marginTop: 28,
            }}
          >
            Photobox bareng, walau nggak bareng.
          </div>
          <div style={{ fontSize: 27, color: "rgba(250,245,235,0.85)", marginTop: 26 }}>
            3..2..1.. cekrek! Satu strip berdua, dari mana saja.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#faf5eb",
            padding: 18,
            gap: 12,
            transform: "rotate(4deg)",
            borderRadius: 6,
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex" }}>
              <div style={{ width: 116, height: 86, background: "#d8ccb8" }} />
              <div style={{ width: 116, height: 86, background: "#c4b49b" }} />
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: 15,
              letterSpacing: 7,
              color: "rgba(38,24,28,0.6)",
            }}
          >
            FOTOIN BARENG
          </div>
        </div>
      </div>
    ),
    size
  );
}
