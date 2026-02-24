import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'tf-engine': path.resolve(__dirname, 'node_modules/tf-engine/dist/index.js')
    }
  },
  optimizeDeps: {
    exclude: ['@crdt-sync/core']
  }
})
