/* Testes automáticos (rodam no QA do Skip a cada versão) — configuração mínima e isolada
   do vite.config.ts: só o alias "@" e ambiente node para funções puras. */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
