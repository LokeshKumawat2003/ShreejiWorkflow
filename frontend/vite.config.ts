import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Export libraries are only loaded via dynamic import(); pre-bundle them so the dev server
  // never serves a stale optimized copy ("Failed to fetch dynamically imported module").
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable', 'xlsx', 'exceljs'],
  },
})
