import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Dev proxy target: override with VITE_API_URL if your local backend runs on
  // a different port or host. Defaults to http://localhost:3001.
  // NOTE: this proxy only applies to `vite dev` (local development). In
  // production, the built frontend is served by the same Express process on
  // Railway, so /api/... requests hit the backend directly — no proxy needed.
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: ['.lhr.life', '.localhost.run'],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        }
      }
    },
    build: {
      outDir: 'dist'
    }
  }
})
