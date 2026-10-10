import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset URLs, so a build can be served from any path, not just a
  // domain root — static hosts, subdirectories and preview links all work.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { host: true },
});
