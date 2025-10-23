import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  platform: 'browser',
  format: ['cjs', 'esm'],
  fixedExtension: true,
})