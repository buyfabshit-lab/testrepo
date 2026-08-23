import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: {
    // Inline the portrait (and any other small asset) as a data URI, so the
    // built app renders complete even when deployed as a single HTML file.
    assetsInlineLimit: 300_000,
  },
});
