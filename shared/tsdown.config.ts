import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  platform: 'node',
  format: ['cjs', 'esm'],
  fixedExtension: true,
  dts: true,
})
