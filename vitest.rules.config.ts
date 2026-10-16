import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testes de rules compartilham um único emulador: sem paralelismo.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
  },
})
