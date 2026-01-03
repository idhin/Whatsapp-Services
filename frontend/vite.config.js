import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { webhookMiddleware } from './webhook-middleware.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), webhookMiddleware()],
  server: {
    proxy: {
      '/session': 'http://localhost:3000',
      '/client': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/groupChat': 'http://localhost:3000',
      '/message': 'http://localhost:3000',
      '/contact': 'http://localhost:3000',
      '/ping': 'http://localhost:3000',
    }
  }
})
