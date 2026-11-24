import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // "production" on the live site, "preview" on test/branch deployments (set by Vercel)
    __DEPLOY_ENV__: JSON.stringify(process.env.VERCEL_ENV || "development"),
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
