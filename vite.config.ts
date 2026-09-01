import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite servir el dev server detras de un tunel ngrok o cloudflare
    // (host header externo).
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.io',
      '.trycloudflare.com',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
