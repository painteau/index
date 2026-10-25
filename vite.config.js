import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // Machine locale seulement : `npm run dev -- --host` pour l'ouvrir au réseau.
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
