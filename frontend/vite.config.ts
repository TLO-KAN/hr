import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = (env.VITE_API_URL || 'http://localhost:3322/api/v1').replace(/\/$/, '');
  const proxyTarget = apiUrl.replace(/\/api(?:\/v\d+)?$/, '');

  return {
    server: {
      host: "::",
      port: 5173,
      proxy: {
        '/api/api/v1': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
