import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'node:path'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Server/domain tests run in node; UI component tests opt into jsdom
    // via the `// @vitest-environment jsdom` docblock at the top of the file.
    // globals:true lets @testing-library/react auto-register cleanup.
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts'],
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
