import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests never hit a real DB; these placeholders satisfy config/env.ts.
    env: {
      DATABASE_URL: 'postgresql://postgres:test@localhost:5432/proxyai_test',
      DIRECT_URL: 'postgresql://postgres:test@localhost:5432/proxyai_test',
      JWT_SECRET: 'test-jwt-secret',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      PAYMENT_PROVIDER: 'mock',
      MOCK_PAYMENT_WEBHOOK_SECRET: 'test-mock-secret',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
