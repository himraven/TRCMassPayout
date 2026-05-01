import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('react-router-dom')) {
            return 'react'
          }
          if (
            id.includes('node_modules/dexie') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/papaparse') ||
            id.includes('node_modules/xlsx')
          ) {
            return 'data'
          }
          if (
            id.includes('node_modules/html2canvas') ||
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jszip') ||
            id.includes('node_modules/qrcode')
          ) {
            return 'export'
          }
          if (id.includes('node_modules/tronweb')) {
            return 'tron'
          }
          return undefined
        },
      },
    },
  },
})
