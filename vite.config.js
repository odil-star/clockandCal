import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Относительные пути к ассетам: сайт работает и на github.io/<repo>/,
  // и при открытии dist/index.html напрямую
  base: './',
  plugins: [react()],
})
