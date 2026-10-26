import { resolve } from 'path'

export default {
  root: resolve(import.meta.dirname, 'src'),
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: 5173
  }
}
