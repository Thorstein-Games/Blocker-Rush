import { ImageResponse } from "next/og";

export const alt = "Blocker Rush puzzle game";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "linear-gradient(135deg, #08111d 0%, #10263d 100%)",
        color: "#f2f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "56px 72px",
        gap: 56,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 340,
          minWidth: 340,
          borderRadius: 36,
          border: "2px solid #3bb0ff",
          background: "rgba(8, 17, 29, 0.8)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.35)",
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 256,
            height: 256,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 28,
            background: "linear-gradient(145deg, #08111d 0%, #193c5f 100%)",
            color: "#eaf6ff",
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          BR
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          flex: 1,
          padding: "44px 52px",
          borderRadius: 30,
          border: "2px solid #3bb0ff",
          background: "rgba(8, 17, 29, 0.78)",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 5,
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
          <div style={{ display: "flex" }}>With Live Multiplayer</div>
        </div>
      </div>
    </div>,
    size,
  );
}
