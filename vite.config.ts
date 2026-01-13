import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      base: './',
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            // Code splitting for better performance
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'chart-vendor': ['recharts'],
              'icon-vendor': ['lucide-react'],
            }
          }
        },
        // Increase chunk size warning limit (we're splitting now)
        chunkSizeWarningLimit: 1000,
      }
    };
});
