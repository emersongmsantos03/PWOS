import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "PW OS — Performance Workspace",
        short_name: "PW OS",
        description: "ERP + CRM da PW Media",
        theme_color: "#1b2838",
        background_color: "#f4f6f8",
        display: "standalone",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      }
    })
  ],
  resolve: { alias: { "@": "/apps/web/src" } },
  build: { outDir: "dist" }
});
