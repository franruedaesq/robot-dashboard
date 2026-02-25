import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tf-engine/core': path.resolve(__dirname, 'node_modules/@tf-engine/core/dist/index.js'),
      '@tf-engine/react': path.resolve(__dirname, 'node_modules/@tf-engine/react/dist/index.js'),
      '@tf-engine/three': path.resolve(__dirname, 'node_modules/@tf-engine/three/dist/index.js')
    }
  },
  optimizeDeps: {
    exclude: ['@crdt-sync/core']
  }
})
