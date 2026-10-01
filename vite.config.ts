import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // регистрируем вручную в main.ts и только в браузере: внутри APK SW отдавал бы старые файлы после обновления
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Lexi — изучаем слова',
        short_name: 'Lexi',
        description: 'Карточки и интервальное повторение для изучения иностранных слов',
        lang: 'ru',
        theme_color: '#0F8B77',
        background_color: '#F6F4EF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
})
