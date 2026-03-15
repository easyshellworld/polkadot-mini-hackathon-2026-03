import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ['buffer', 'process', 'stream'] }),
  ],
  resolve: {
    alias: {
      // Polyfills for Polkadot.js dependencies
      stream: 'stream-browserify',
    },
  },
  define: {
    // Required for Polkadot.js in browser
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
