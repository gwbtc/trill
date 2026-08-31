import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";

// https://vite.dev/config/
export default defineConfig({
  base: "/apps/nostrill",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/wouter/") ||
            id.includes("/zustand/") ||
            id.includes("/react-hot-toast/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("/nostr-tools/") || id.includes("/@nostrify/")) {
            return "vendor-nostr";
          }
          if (
            id.includes("/urbit-api/") ||
            id.includes("/urbit-ob/") ||
            id.includes("/urbit-sigils/")
          ) {
            return "vendor-urbit";
          }
          if (id.includes("/@tanstack/")) {
            return "vendor-query";
          }
          return undefined;
        },
        assetFileNames: (a) => {
          let hash = createHash("sha256");
          hash.update(a.source);
          const name = a.names.join("-");
          hash.update(name);
          const str = hash.digest("hex").slice(0, 16);
          return `assets/${str}-${name.toLowerCase()}`;
        },
        entryFileNames: (c) => {
          let hash = createHash("sha256");
          for (let m of c.moduleIds) {
            hash.update(m);
          }
          const str = hash.digest("hex").slice(0, 16);
          return `assets/${str}-${c.name.toLowerCase()}.js`;
        },
        chunkFileNames: (c) => {
          let hash = createHash("sha256");
          for (let m of c.moduleIds) {
            hash.update(m);
          }
          const str = hash.digest("hex").slice(0, 16);
          return `assets/${str}-${c.name.toLowerCase()}.js`;
        },
      },
    },
  },
});
