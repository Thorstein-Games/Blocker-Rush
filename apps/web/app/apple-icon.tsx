import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
          color: "#eaf6ff",
          fontFamily: "Arial, sans-serif",
          fontSize: 58,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        BR
      </div>
    ),
    size,
  );
}
