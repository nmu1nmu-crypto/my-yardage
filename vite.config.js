import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
export default {
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: { commonjsOptions: { include: [/maplibre-gl/, /node_modules/] } },

  plugins: [react()],
  server: { host: true },
});
