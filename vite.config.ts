import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Menyediakan shim untuk process.env agar kompatibel dengan SDK di sisi client
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY || ''),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react', '@google/genai']
        }
      }
    }
  }
});