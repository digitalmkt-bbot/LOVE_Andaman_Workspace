import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    // Railway supplies this at runtime; the explicit domain supports the current
    // service URL too when the provider does not expose RAILWAY_PUBLIC_DOMAIN.
    allowedHosts: [
      'loveandamanworkspace-pano-frontend-copy-production-b0b1.up.railway.app',
      ...(process.env.RAILWAY_PUBLIC_DOMAIN ? [process.env.RAILWAY_PUBLIC_DOMAIN] : []),
    ],
  },
  server: {
    port: 5173,
    // The SPA never talks to Postgres. Everything goes through the API.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
