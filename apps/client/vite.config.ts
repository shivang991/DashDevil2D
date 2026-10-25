import path from "path";
import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "local-transport-config",
      configureServer(server) {
        server.middlewares.use("/__transport-config", (_request, response) => {
          const file = process.env.DASHDEVIL_TRANSPORT_CONFIG;
          if (!file) {
            response.statusCode = 503;
            response.end("HTTPS transport tooling is not running");
            return;
          }
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(fs.readFileSync(file));
        });
      },
    },
  ],
  server: process.env.DASHDEVIL_HTTPS_CERT
    ? {
        https: {
          cert: fs.readFileSync(process.env.DASHDEVIL_HTTPS_CERT),
          key: fs.readFileSync(process.env.DASHDEVIL_HTTPS_KEY!),
        },
      }
    : undefined,
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        transport: path.resolve(__dirname, "transport.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
