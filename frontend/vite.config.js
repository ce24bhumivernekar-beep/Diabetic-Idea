import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
//
// Everything is served from one origin: the API and the generated images are
// proxied through the dev server. That means
//   - a phone only needs port 5173 open, not 8080 and 8000 as well
//   - an HTTPS tunnel in front of 5173 covers the whole app, so there is no
//     mixed-content block and the in-page camera works on a phone
//   - no CORS preflight in normal use
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    server: {
      // Listen on every interface so a phone on the same Wi-Fi can open the app.
      host: true,
      port: 5173,
      strictPort: true,
      // A tunnel presents a hostname Vite has never seen; without this it
      // refuses the request as a possible DNS-rebinding attempt.
      allowedHosts: [".ts.net", ".local", "localhost"],
      proxy: {
        "/api": {
          target: env.VITE_PROXY_API || "http://localhost:8080",
          changeOrigin: true,
          // Server-sent events must stream, never buffer.
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              if (
                (proxyRes.headers["content-type"] || "").includes(
                  "text/event-stream",
                )
              ) {
                proxyRes.headers["cache-control"] = "no-cache, no-transform";
              }
            });
          },
        },
        "/generated": {
          target: env.VITE_PROXY_AI || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
