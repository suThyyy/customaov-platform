/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:6174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    // Bound jsdom workers: unrestricted parallel App imports can outlive a
    // test timeout and pollute the following test after its cleanup runs.
    maxWorkers: 4,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Không để `.env.local` của dev (vd. VITE_DATA_SOURCE=supabase) đổi chế độ khi chạy test.
    // Test cần chế độ khác tự ép bằng vi.mock/vi.stubEnv.
    env: { VITE_DATA_SOURCE: 'mock', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
