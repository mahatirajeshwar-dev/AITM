import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite proxies /api and /uploads to the Express server (relative URLs everywhere).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
