// Renders the PNG icons of the favicon set from static/favicon.svg (spec §4.2): a 32 px favicon for browsers that
// ignore SVG icons and the 180 px apple-touch-icon for iOS home screens. It uses the Playwright Chromium installed for
// the browser suite. Run it after changing favicon.svg:
//   PLAYWRIGHT_BROWSERS_PATH=/home/user/pw node --import tsx scripts/render-favicons.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const svg = 'data:image/svg+xml;base64,' + readFileSync(resolve('static/favicon.svg')).toString('base64')
const browser = await chromium.launch()
for (const { size, file } of [{ size: 32, file: 'favicon-32.png' }, { size: 180, file: 'apple-touch-icon.png' }]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0}img{display:block;width:${size}px;height:${size}px}</style><img src="${svg}" alt="">`)
  await page.locator('img').evaluate((image: HTMLImageElement) => image.decode())
  await page.screenshot({ path: resolve('static', file), clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
  console.log('wrote', file)
}
await browser.close()
