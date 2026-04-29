import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(), 
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true,
      },
    })
  ],
  // ADD THIS SECTION:
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/http-bind': {
        target: process.env.PROSODY_URL || 'http://localhost:5280',
        changeOrigin: true,
      },
      '/upload': {
        target: process.env.PROSODY_URL || 'http://localhost:5280',
        changeOrigin: true,
      },
    },
  },
});
