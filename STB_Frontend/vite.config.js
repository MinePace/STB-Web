import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // "production" on the live site, "preview" on test/branch deployments (set by Vercel)
    // version number from package.json, shown in the footer
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DEPLOY_ENV__: JSON.stringify(process.env.VERCEL_ENV || "development"),
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: they rarely change, so browsers keep them cached.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          i18n: ["i18next", "react-i18next"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: true,
    allowedHosts: [
      'unvainly-untripped-onie.ngrok-free.dev'
    ]
  }
})
