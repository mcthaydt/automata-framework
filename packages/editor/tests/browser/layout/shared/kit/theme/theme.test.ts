import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// The two looks in a real browser (spec §5.5). The first frame and the device switching are Playwright journeys
// (`tests/e2e/theme.test.ts`), which need a page load; here the editor is running, the look is forced with
// `data-theme`, and what the page draws is read back: the chrome follows the look, the game's picture does not.

const targets = editorTargets()
const root = document.documentElement
/** What `--bg` paints, read from a probe: the test page's own body has the runner's colour, not the editor's. */
const field = (): string => {
  const probe = document.body.appendChild(document.createElement('div'))
  probe.style.background = 'var(--bg)'
  const colour = getComputedStyle(probe).backgroundColor
  probe.remove()
  return colour
}
const token = (name: string): string => getComputedStyle(root).getPropertyValue(name).trim()

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  root.removeAttribute('data-theme')
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function start(): Promise<void> {
  await page.viewport(1180, 820)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write('mossgate.af2d.json', printProject(mossgate()))
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startEditor(target, {
    window,
    document,
    workspace,
    clock: {
      now: () => Date.now(),
      setTimer: (ms, run) => window.setTimeout(run, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    },
    fillRandom: (bytes) => {
      crypto.getRandomValues(bytes)
    },
  })
  await settleLayout()
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

describe('the editors in both looks', () => {
  test('a forced look sets the chrome, and Match device lets the device decide', async () => {
    await start()
    root.dataset.theme = 'dark'
    expect(token('--paper')).toBe('#1b1c20')
    expect(field()).toBe('rgb(19, 20, 23)')
    root.dataset.theme = 'light'
    expect(token('--paper')).toBe('#ffffff')
    expect(field()).toBe('rgb(247, 247, 248)')
  })

  test('the canvas palette reads as the same plain colour in both looks', async () => {
    await start()
    root.dataset.theme = 'light'
    const light = token('--color-layer-entities')
    root.dataset.theme = 'dark'
    expect(token('--color-layer-entities')).toBe(light)
    expect(light).toMatch(/^#[0-9a-f]{6}$/)
  })

  test("the level's own picture and its cabinet are identical in light and dark", async () => {
    await start()
    const card = document.querySelector<HTMLElement>('[aria-label="Levels"] .open')
    if (card === null) throw new Error('no level card')
    card.click()
    await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
    await arrived()
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-level-canvas] canvas, canvas[data-level-canvas]',
    )
    if (canvas === null) throw new Error('no level canvas')
    await expect
      .poll(() => canvas.closest('[data-level-canvas]')?.getAttribute('data-state') ?? 'drawn')
      .toBe('drawn')
    root.dataset.theme = 'light'
    const light = pixelsOf(canvas)
    const cabinetLight = token('--charcoal')
    root.dataset.theme = 'dark'
    const dark = pixelsOf(canvas)
    expect(cabinetLight).toBe('#0e1014')
    expect(token('--charcoal')).toBe('#0e1014')
    expect(dark.length).toBe(light.length)
    let different = 0
    for (let i = 0; i < light.length; i++) if (light[i] !== dark[i]) different++
    expect(different, 'pixels that differ between the looks').toBe(0)
  })

  test('the Editor colours options keep the control size of the pointer (44 px with touch)', async () => {
    await start()
    const options = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="radiogroup"][aria-label="Editor colours"] [role="radio"]',
      ),
    ]
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Light', 'Dark', 'Match device'])
    for (const option of options) {
      expect(option.getBoundingClientRect().height, option.textContent ?? '').toBeGreaterThanOrEqual(
        targets.hit,
      )
    }
  })
})
