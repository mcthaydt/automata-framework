// Encodes WebP copies of the JPEG previews at 640 px and at full width (spec §4.2: AVIF or WebP previews with a
// fallback, and no image more than 2× its rendered size). It uses the Playwright Chromium already installed for the
// browser suite, so the site needs no native image library. Run it after adding or replacing a preview:
//   PLAYWRIGHT_BROWSERS_PATH=/home/user/pw node scripts/encode-previews.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const PREVIEW_WIDTHS = [640] as const
const QUALITY = 0.82
const directory = resolve('static/previews')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const file of readdirSync(directory)
  .filter((name) => name.endsWith('.jpg'))
  .sort()) {
  const source = 'data:image/jpeg;base64,' + readFileSync(join(directory, file)).toString('base64')
  const encoded = await page.evaluate(
    async ({ source, widths, quality }) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const out: Record<string, string> = {}
      for (const width of [...widths, image.naturalWidth]) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth)
        const context = canvas.getContext('2d')!
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        out[width === image.naturalWidth ? 'full' : String(width)] = canvas.toDataURL('image/webp', quality)
      }
      return out
    },
    { source, widths: [...PREVIEW_WIDTHS], quality: QUALITY },
  )
  const base = file.replace(/\.jpg$/, '')
  for (const [size, dataUrl] of Object.entries(encoded)) {
    if (!dataUrl.startsWith('data:image/webp')) throw new Error(`${file}: this browser cannot encode WebP`)
    const name = size === 'full' ? `${base}.webp` : `${base}-${size}.webp`
    writeFileSync(join(directory, name), Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log('wrote', name)
  }
}
await browser.close()
