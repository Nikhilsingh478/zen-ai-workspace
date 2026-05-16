import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  
  return {
    plugins: [
      tailwindcss(),
      react(),
      tsconfigPaths({
        ignoreConfigErrors: true,
      }),
    ],
    // Explicitly inject environment variables to prevent Capacitor build stripping.
    // This guarantees the variables are hardcoded into the output bundle.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    // CRITICAL for Capacitor Android:
    // Capacitor serves assets from the local filesystem inside the WebView.
    // With base '/' (default), Vite emits paths like /assets/index.js which
    // the WebView cannot resolve — there is no server. Setting base './'
    // makes Vite emit relative paths (./assets/index.js) which resolve
    // correctly from any origin, including capacitor://localhost/.
    base: "./",
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
  };
});
