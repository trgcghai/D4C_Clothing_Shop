import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_API_PROXY_URL || 'http://localhost:8080'

const proxyConfig = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  server: { proxy: proxyConfig },
  preview: { proxy: proxyConfig },
})

export default config
