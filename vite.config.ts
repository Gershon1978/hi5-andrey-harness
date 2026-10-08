import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: {
          protocol: 'http:',
          hostname: '127.0.0.1',
          port: 3001,
        },
        changeOrigin: true,
      },
    },
  },
});
