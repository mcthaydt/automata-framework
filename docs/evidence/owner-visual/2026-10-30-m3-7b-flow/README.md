# M3.7b part 4: base-3d's flow, review images

Captured 2026-10-31 from the e2e preview build (`pnpm --filter @af-games/base-3d e2e:game`'s `vite build` and `vite preview` under Ruken's headers), standalone in headless Chromium with SwiftShader WebGL2, at the two landscape sizes the game holds (844×390 and 780×270), and the portrait rotate hint at 390×844 on a touch phone. The journey holds keys in real time, so Wick's exact spot and the end time vary run to run. Every page logged zero console errors and zero CSP violations.

Everything here is new: part 3's scene (`../2026-10-30-m3-7b-scene/`) is unchanged except the ember.

| Image | What it shows |
|---|---|
| `1-splash-*` | The new splash (`src/screens/SplashScreen.svelte`): the framework's mark, the game's title and "Press any key or tap". It moves on to the menu on a key, a tap or after 1.5 s. |
| `2-menu-*` | The menu is the default title screen (`@mcthaydt/automata-game`): the title and one primary Play, focused. It is black because the title drops the previous run's sim and the renderer draws nothing without one. |
| `3-room-hall-*` | Play (the default play screen and part 3's scene) right after Play: Wick in the hall, the pause button top right. |
| `4-room-kiln-ember-*` | After W held into the kiln's north wall and S held into its west wall: Wick in the north-west corner beside the **ember**, the new orange 0.3 m block (Endesga 64 #fb6b1d) at (−3.2, 11.2). The black right half is the void past the room's north wall, which the kiln's view looks along; part 3's camera, unchanged. |
| `5-paused-*` | Escape pauses: the default paused screen over the dimmed room, Resume focused. |
| `6-end-*` | Resume, then F in reach of the ember: the sim emits `ember.taken`, the round completes, and the new end screen (`src/screens/EndScreen.svelte`) shows "The ember is yours", the run's time and one primary Menu, over the last frame dimmed as paused dims play (`af-game-menu--scrim`). Menu goes back to the menu (checked by the script, not imaged). |
| `7-rotate-hint-390x844` | Portrait on a phone: the runtime's rotate hint ("Turn your phone sideways") covers the landscape game, which is paused under it (`rotateHint: 'block'`, the default). The splash shows dimmed behind it. |

## How to capture again

Build and serve the e2e build, then run the script below with `playwright` resolvable (for example from a folder whose `node_modules` links to `games/base-3d/node_modules`):

```sh
cd games/base-3d
AF_E2E_HOST_ORIGIN=http://127.0.0.1:1 pnpm exec vite build --configLoader runner
pnpm exec vite preview --configLoader runner --base /b/202610310000-e2e0b3d/ --strictPort --host localhost --port 5591 &
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local node capture.mjs http://localhost:5591/b/202610310000-e2e0b3d/ <out-dir>
```

```js
// Captures base-3d's flow review images (M3.7b part 4) from the e2e preview build, standalone in Chromium (SwiftShader
// WebGL2), at 844×390 and 780×270, plus the rotate hint in portrait on a coarse pointer. Usage:
//   node capture.mjs <gameUrl> <outDir>
import { chromium } from 'playwright'

const [gameUrl, outDir] = process.argv.slice(2)
const screen = (page, id) => page.locator(`[data-layer="screens"] [data-screen="${id}"]`)
const browser = await chromium.launch()

async function hold(page, code, ms) {
  await page.keyboard.down(code)
  await page.waitForTimeout(ms)
  await page.keyboard.up(code)
}

for (const [width, height] of [
  [844, 390],
  [780, 270],
]) {
  const page = await browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const shot = (name) => page.screenshot({ path: `${outDir}/${name}-${width}x${height}.png` })
  await page.goto(gameUrl)
  await page.locator('html[data-state="ready"]').waitFor({ state: 'attached' })
  await screen(page, 'splash').waitFor({ state: 'attached', timeout: 60_000 })
  await shot('1-splash')
  await page.keyboard.press('KeyX')
  await screen(page, 'title').waitFor({ state: 'attached', timeout: 60_000 })
  await shot('2-menu')
  await page.locator('button', { hasText: /^Play$/ }).click()
  await screen(page, 'play').waitFor({ state: 'attached', timeout: 60_000 })
  await page.locator('canvas').waitFor()
  await page.waitForTimeout(3000)
  await shot('3-room-hall')
  // Into the north wall of the kiln (the stick latches through the doorway), then the west wall: the corner.
  await hold(page, 'KeyW', 6000)
  await hold(page, 'KeyS', 3000)
  await page.waitForTimeout(1500)
  await shot('4-room-kiln-ember')
  await page.keyboard.press('Escape')
  await screen(page, 'paused').waitFor({ state: 'attached', timeout: 60_000 })
  await shot('5-paused')
  await page.locator('button', { hasText: /^Resume$/ }).click()
  await screen(page, 'play').waitFor({ state: 'attached', timeout: 60_000 })
  await page.waitForTimeout(1000)
  await page.keyboard.down('KeyF')
  await screen(page, 'end').waitFor({ state: 'attached', timeout: 60_000 })
  await page.keyboard.up('KeyF')
  await shot('6-end')
  await page.locator('button', { hasText: /^Menu$/ }).click()
  await screen(page, 'title').waitFor({ state: 'attached', timeout: 60_000 })
  console.log(`${width}x${height} errors:`, JSON.stringify(errors))
  await page.close()
}

// Portrait on a phone: the rotate hint covers the landscape game.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
await phone.goto(gameUrl)
await phone.locator('[data-testid="rotate-hint"]').waitFor()
await phone.screenshot({ path: `${outDir}/7-rotate-hint-390x844.png` })
await browser.close()
```
