// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- 1. Importer
import path from "path" // <-- Shadcn en aura besoin plus tard, autant l'ajouter
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      tailwindcss(), // <-- 2. Ajouter le plugin
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"), // <-- Shadcn va l'ajouter, on peut anticiper
      },
    },
    server: {
      https: {
        key: fs.readFileSync(path.resolve(__dirname, `./ssl/${env.VITE_SSL_CERT_NAME || '127.0.0.1+4'}-key.pem`)),
        cert: fs.readFileSync(path.resolve(__dirname, `./ssl/${env.VITE_SSL_CERT_NAME || '127.0.0.1+4'}.pem`)),
      },
      host: env.VITE_SERVER_HOST,
      port: parseInt(env.VITE_FRONTEND_PORT || '5173'),
      proxy: {
        '/api': {
          target: `https://${env.VITE_SERVER_HOST || 'localhost'}:${env.VITE_API_PORT || '3000'}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})