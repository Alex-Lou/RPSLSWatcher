import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// RPSLSWatcher — PWA installable (Cloudflare Pages). Les Pages Functions de
// `functions/` ne sont PAS buildées par Vite (Cloudflare les déploie à part).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      devOptions: { enabled: false },
      manifest: {
        name: "RPSLS Watcher",
        short_name: "Watcher",
        description: "Monitoring & analyse cyberpunk des parties Constellation Pro.",
        theme_color: "#05070d",
        background_color: "#05070d",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  build: { target: "es2022" },
});
