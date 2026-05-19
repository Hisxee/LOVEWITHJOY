import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(rootDir, 'src')

export default defineConfig({
  root: rootDir,
  plugins: [vue(), tsconfigPaths()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
})
