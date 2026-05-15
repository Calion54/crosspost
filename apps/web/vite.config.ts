import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // VNC WebSocket goes directly to the browser container, which hosts
      // websockify internally and handles the upgrade in-process. The API
      // is not involved — avoiding a Docker NAT loopback that fails from
      // the long-running API runtime on macOS.
      '/api/vnc': {
        target: 'http://localhost:5175',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
});
