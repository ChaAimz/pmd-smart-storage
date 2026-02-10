import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('react-grid-layout') || id.includes('react-resizable')) {
            return 'vendor-grid'
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts'
          }

          if (id.includes('@radix-ui')) {
            return 'vendor-radix'
          }

          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }

          if (id.includes('flowbite')) {
            return 'vendor-flowbite'
          }

          if (id.includes('xlsx')) {
            return 'vendor-xlsx'
          }

          if (
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('react-dom')
          ) {
            return 'vendor-react'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
