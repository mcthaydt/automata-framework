import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import { chooseEditor, editorList } from '#src/testing/suite/suite-layout.ts'

// The two looks in a real browser (spec §5.5). The first frame and the device switching are Playwright journeys
// (`tests/e2e/theme.test.ts`), which need a page load; here the suite is running with the real level canvas, the look is
// forced with `data-theme`, and what the page draws is read back: the chrome follows the look, the game's picture does not.

const targets = editorTargets()
const root = document.documentElement
const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}
const HOST = '[data-level-canvas]'
const CANVAS = `${HOST} canvas`

/** What `--bg` paints, read from a probe: the test page's own body has the runner's colour, not the editor's. */
const field = (): string => {
  const probe = document.body.appendChild(document.createElement('div'))
  probe.style.background = 'var(--bg)'
  const colour = getComputedStyle(probe).backgroundColor
  probe.remove()
  return colour
}
const token = (name: string): string => getComputedStyle(root).getPropertyValue(name).trim()

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  root.removeAttribute('data-theme')
  root.style.removeProperty('--color-stage-grid')
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

/** The suite on Home, with the real level canvas (no stand-in), at 1180 x 820. */
async function start(): Promise<void> {
  await page.viewport(1180, 820)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  let next = 0
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(FILES),
    suite: createSuite({
      editors: [
        createLevels2d({
          ids: {
            next: () => {
              next += 1
              return `thing-${next}`
            },
          },
        }) as SuiteEditor<unknown>,
      ],
    }),
  })
  await settleLayout()
}

/** Open Levels and wait until the real canvas has drawn the level. */
async function openLevel(): Promise<HTMLCanvasElement> {
  await chooseEditor('Levels')
  await expect.poll(() => document.querySelector(CANVAS)).not.toBeNull()
  const canvas = document.querySelector<HTMLCanvasElement>(CANVAS)
  if (canvas === null) throw new Error('no level canvas')
  await drawn()
  return canvas
}

const state = (): string | null => document.querySelector(HOST)?.getAttribute('data-state') ?? null
const camera = (): string | null => document.querySelector(HOST)?.getAttribute('data-camera') ?? null
/** The canvas says it has drawn, and two frames have passed since. */
async function drawn(): Promise<void> {
  await expect.poll(state).toBe('drawn')
  await frames(2)
}
const frames = async (count: number): Promise<void> => {
  for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * The canvas's own pixels, copied out, as drawn when the box becomes `width` wide. A WebGL canvas is cleared once its
 * frame has been shown, so the copy is made in the task that draws: the draw publishes `data-camera` right after it
 * renders, and that attribute is what this waits for. The box then goes back to 1180, so every look is drawn at the
 * same size from the same start, and nothing is read from an old frame.
 */
async function drawnAt(canvas: HTMLCanvasElement, width: number): Promise<Uint8ClampedArray> {
  const host = document.querySelector(HOST)
  if (host === null) throw new Error('no level canvas host')
  const seen = new Promise<Uint8ClampedArray>((resolve) => {
    const watcher = new MutationObserver(() => {
      watcher.disconnect()
      resolve(pixelsOf(canvas))
    })
    watcher.observe(host, { attributes: true, attributeFilter: ['data-camera'] })
  })
  await page.viewport(width, 820)
  const pixels = await seen
  await page.viewport(1180, 820)
  await settleLayout()
  await drawn()
  return pixels
}

/** The canvas's own pixels, copied out: the bars that float over its box are not part of them. */
function pixelsOf(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  let count = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++
  return count
}
/** How many pixels are not the colour of the first pixel: a blank read has none. */
const painted = (pixels: Uint8ClampedArray): number => {
  let count = 0
  for (let i = 4; i < pixels.length; i += 4)
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) count++
  return count
}

describe('the editors in both looks', () => {
  test('with no attribute the page is dark, and a forced look sets the chrome', async () => {
    await start()
    expect(token('--paper')).toBe('#111316')
    expect(field()).toBe('rgb(11, 12, 14)')
    root.dataset.theme = 'light'
    expect(token('--paper')).toBe('#ffffff')
    expect(field()).toBe('rgb(244, 244, 245)')
    root.dataset.theme = 'dark'
    expect(token('--paper')).toBe('#111316')
  })

  test('the canvas palette reads as the same plain colour in both looks', async () => {
    await start()
    root.dataset.theme = 'light'
    const light = token('--color-stage-grid')
    root.dataset.theme = 'dark'
    expect(token('--color-stage-grid')).toBe(light)
    expect(light).toMatch(/^#[0-9a-f]{6}$/)
  })

  test("the level's own picture and its cabinet are identical in light and dark, each drawn afresh", async () => {
    await start()
    const canvas = await openLevel()
    root.dataset.theme = 'light'
    const light = await drawnAt(canvas, 1181)
    const cabinetLight = token('--charcoal')
    root.dataset.theme = 'dark'
    const dark = await drawnAt(canvas, 1181)
    expect(painted(dark), 'a level drawn, not a blank read').toBeGreaterThan(1000)
    expect(cabinetLight).toBe('#08090b')
    expect(token('--charcoal')).toBe('#08090b')
    expect(dark.length).toBe(light.length)
    expect(differing(light, dark), 'pixels that differ between the looks').toBe(0)
  })

  test("the comparison can see a change: the grid's colour, moved, shows in the next draw", async () => {
    // Without this the test above could pass on a canvas that never redraws.
    await start()
    const canvas = await openLevel()
    const before = await drawnAt(canvas, 1181)
    root.style.setProperty('--color-stage-grid', '#ff00ff')
    const after = await drawnAt(canvas, 1181)
    expect(differing(before, after), 'pixels that changed with the colour').toBeGreaterThan(0)
  })

  test('the Editor colours options keep the control size of the pointer (44 px with touch)', async () => {
    await start()
    await arrived()
    const options = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="radiogroup"][aria-label="Editor colours"] [role="radio"]',
      ),
    ]
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Dark', 'Light', 'Match device'])
    for (const option of options) {
      expect(option.getBoundingClientRect().height, option.textContent ?? '').toBeGreaterThanOrEqual(
        targets.hit,
      )
    }
  })
})
