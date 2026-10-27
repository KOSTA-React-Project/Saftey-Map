import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api 요청을 Express 서버(server/)로 전달
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
