import { defineConfig } from "vite";

export default defineConfig({
  base: "/algo-trading-dashboard/",  // must match your GitHub repo name exactly
  server: { port: 5173, open: true },
  build: { outDir: "dist" },
});
