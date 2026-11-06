import { build } from 'vite'
import { resolve } from 'node:path'
await build({
  configFile: false,
  root: resolve('workshop'),
  base: './',
  build: { outDir: resolve('static/demos/first-change'), emptyOutDir: true },
})
