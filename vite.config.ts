import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,        // البورت اللي هيشتغل عليه
    open: true,        // يفتح المتصفح تلقائياً
    host: true,        // يشتغل على الشبكة المحلية كمان
    hmr: {
      overlay: true,   // يعرض الأخطاء على الشاشة
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})