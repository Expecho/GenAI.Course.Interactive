import { ImageResponse } from "next/og";

// Preview image shown when a link to the course is shared in Slack, Teams,
// LinkedIn, etc. Next.js serves it at /opengraph-image and adds the og:image
// tags to the page metadata automatically.
export const alt = "Generative AI Workshop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 32, color: "#93c5fd", marginBottom: 24 }}>
          Hands-on workshop
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.1 }}>
          Generative AI Workshop
        </div>
        <div style={{ fontSize: 36, color: "#cbd5e1", marginTop: 32, maxWidth: 900 }}>
          Edit code and watch it run live.
        </div>
      </div>
    ),
    size,
  );
}
