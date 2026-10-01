import { defineConfig } from 'vitest/config.js'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
  },
})
