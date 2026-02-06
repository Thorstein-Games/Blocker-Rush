import { ImageResponse } from "next/og";

export const alt = "Blocker Rush social card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          background: "#06101b",
          color: "#f0f7fd",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            border: "20px solid #0f2238",
            borderRadius: 28,
            margin: 24,
            padding: "42px 56px",
            background: "linear-gradient(160deg, #08111d 0%, #163758 100%)",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#80d0ff",
            }}
          >
            BLOCKER RUSH
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 78,
                fontWeight: 800,
                lineHeight: 1.03,
              }}
            >
              <div style={{ display: "flex" }}>Daily challenge.</div>
              <div style={{ display: "flex" }}>Practice mode.</div>
              <div style={{ display: "flex" }}>Multiplayer races.</div>
            </div>
            <div
              style={{
                fontSize: 30,
                color: "#d2e8f6",
              }}
            >
              Solve fast. Share results. Beat your streak.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
