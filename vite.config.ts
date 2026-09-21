import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // index.html: 걷기 게임(메인) · classic.html: 예전 Carnet(기자·미션 버전)
  build: { rollupOptions: { input: { main: 'index.html', classic: 'classic.html' } } },
})
