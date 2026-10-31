import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Deliberately excludes the game's HTTPS transport and multi-page build settings.
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
