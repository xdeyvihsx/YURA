import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;
// Tauri sets TAURI_ENV_PLATFORM when it runs `beforeDevCommand`.
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

/** Browser preview (no Tauri): run the music server inside the dev server, same address. */
function embeddedMusicServer(): Plugin {
  return {
    name: "yura-embedded-music-server",
    apply: "serve",
    async configureServer(server) {
      const serverPath = path.resolve(__dirname, "sidecar-app/index.js");
      const { default: app } = await import(/* @vite-ignore */ serverPath);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.startsWith("/api/") || url.startsWith("/health")) return (app as any)(req, res, next);
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), ...(isTauri ? [] : [embeddedMusicServer()])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: isTauri
    ? {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
          ? {
              protocol: "ws",
              host,
              port: 1421,
            }
          : undefined,
        watch: {
          // 3. tell Vite to ignore watching `src-tauri`
          ignored: ["**/src-tauri/**"],
        },
      }
    : {
        port: 8080,
        host: "::",
        watch: { ignored: ["**/src-tauri/**"] },
      },
}));
