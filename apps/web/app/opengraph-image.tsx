import { ImageResponse } from "next/og";

export const alt = "AIx — trending dev tools, harshly judged";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default site-wide social-preview card. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "28px",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, color: "#f97316" }}>AIx</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
          Trending dev tools, harshly judged.
        </div>
        <div style={{ fontSize: 34, color: "#a3a3a3", lineHeight: 1.3 }}>
          A GitHub-tools directory for AI-first engineers. Every tool distilled to one
          verdict and a score out of 100.
        </div>
      </div>
    ),
    size,
  );
}
