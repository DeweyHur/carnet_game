import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // walk.html: 걷기 프로토타입(실험용 별도 페이지)
  build: { rollupOptions: { input: { main: 'index.html', walk: 'walk.html' } } },
})
