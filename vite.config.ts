import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat typelessity-widget as custom element (Web Component)
          isCustomElement: (tag) => tag.startsWith('typelessity-')
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://medbook-vue.netlify.app',
        changeOrigin: true,
        secure: true
      }
    },
    fs: {
      // Allow serving files from typelessity widget
      allow: ['..']
    }
  }
})
