import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({
      ignoreConfigErrors: true,
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ["@tanstack/react-start", "@cloudflare/vite-plugin"],
  },
});
