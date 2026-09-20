import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3100'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // 编辑器/工具以「临时目录 + 原子重命名」写文件时，watcher 在 Windows 上会撞到
    // EBUSY 并直接崩掉 dev server。忽略这些瞬时产物。
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmp', '**/.*.tmp'],
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
