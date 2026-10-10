import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import http from "node:http";

function mongoBackendPlugin(): Plugin {
  let backendServer: http.Server | null = null;
  return {
    name: "eventease:mongo-backend",
    apply: "serve",
    async configureServer() {
      try {
        const { app } = await import("./backend/app");
        // Check if backend is already listening on 5000
        const testReq = http.get("http://127.0.0.1:5000/api/health", () => {
          console.log("[Vite] Standalone backend already active on port 5000.");
        });
        testReq.on("error", () => {
          backendServer = app.listen(5000, "127.0.0.1", () => {
            console.log("[Vite] EventEase MongoDB API server started on http://127.0.0.1:5000");
          });
        });
      } catch (err) {
        console.error("[Vite] Could not initialize backend server:", err);
      }
    },
    buildEnd() {
      if (backendServer) backendServer.close();
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [mongoBackendPlugin()],
    server: {
      host: "0.0.0.0",
      port: 8080,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
