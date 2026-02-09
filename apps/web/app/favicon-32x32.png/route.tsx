import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #08111d 0%, #193c5f 100%)",
          borderRadius: 7,
          color: "#eaf6ff",
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 0.5,
        }}
      >
        BR
      </div>
    ),
    {
      width: 32,
      height: 32,
    },
  );
}
