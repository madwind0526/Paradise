import { defineConfig } from "vite";

// Separate local ports keep Paradise independent from Voyager.
export default defineConfig({
  base: process.env.PARADISE_BASE ?? "/",
  server: {
    host: "127.0.0.1",
    port: 5187,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.PARADISE_API_PORT ?? 4317}` },
  },
  build: {
    rollupOptions: { input: { main: "index.html", studio: "studio.html" } },
  },
});
