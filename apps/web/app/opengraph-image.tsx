import { ImageResponse } from "next/og";

export const alt = "Blocker Rush puzzle game";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #08111d 0%, #10263d 100%)",
          color: "#f2f7fb",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            width: 1040,
            padding: "52px 64px",
            borderRadius: 24,
            border: "2px solid #3bb0ff",
            background: "rgba(8, 17, 29, 0.78)",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#66c7ff",
            }}
          >
            BLOCKER RUSH
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
            }}
          >
            <div style={{ display: "flex" }}>Daily Logic Puzzle</div>
            <div style={{ display: "flex" }}>and Live Multiplayer</div>
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#c8dfef",
            }}
          >
            Train with casual boards, then race in real-time rooms.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
