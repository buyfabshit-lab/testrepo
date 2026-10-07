import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PRESSLINE OS", template: "%s · PRESSLINE" },
  description: "Midnight Fusion shop OS — quotes, orders, production, design studio, Outlaw dispatcher, the Clubhouse.",
};
export const viewport: Viewport = { themeColor: "#0d0c0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-mf-bg text-mf-cream">{children}</body>
    </html>
  );
}
