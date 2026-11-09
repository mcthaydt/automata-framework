import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import {
  dockToggle,
  editorControl,
  editorList,
  inShell,
  inView,
  noPageScroll,
  type OpenedSuite,
  openSuite,
} from '#src/testing/suite/suite-layout.ts'

// The 2D level editor in the suite's one shell with the production CSS in real browsers at the sizes of spec §10: its
// regions sit inside the shell under one top bar, every target is at least 44 px, the page never scrolls, and a
// rotation keeps the session. The canvas is a stand-in that shows what it is handed; pixels are the editor's own canvas
// project. The 3D editor's twin of this test is in editor-3d.

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}

let next = 0
const editors = (): SuiteEditor<unknown>[] => [
  fixtureEditor as SuiteEditor<unknown>,
  createLevels2d({
    ids: {
      next: () => {
        next += 1
        return `thing-${next}`
      },
    },
    canvas: StandInLevelCanvas,
  }) as SuiteEditor<unknown>,
]

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

const READY = '[data-testid="level-canvas"]'

describe.each(SIZES)('Suite Levels 2D at $name ($width x $height)', (size) => {
  test('fills the one shell: the stage has room, every target 44 px, the level picker in the top bar', async () => {
    opened = await openSuite(size, editors(), FILES, READY, 'Levels')
    const { conditions } = opened
    const surface = inShell('[data-testid="level-surface"]')
    inView(surface, size)
    // The levels are a picker in the suite's top bar, so there is no dock and no Dock toggle.
    const picker = [...document.querySelectorAll<HTMLElement>('button')].find((button) =>
      button.getAttribute('aria-label')?.startsWith('Level: '),
    )
    if (picker === undefined) throw new Error('no level picker')
    expect(dockToggle()).toHaveLength(0)
    // The picker is among the editing tools, which scroll sideways when the bar is short of room (until 12.7 redoes the
    // suite's bar): scrolled to, it is wholly in view and a full-size target.
    picker.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    await settleLayout()
    expect(checkLayout(conditions, [editorControl('Levels'), picker])).toEqual([])
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-levels-2d-${size.name}.png` })
  })

  test('a rotation keeps the session: the chosen tool is still chosen', async () => {
    opened = await openSuite(size, editors(), FILES, READY, 'Levels')
    await page.getByRole('radio', { name: 'Eraser' }).click()
    await expect.poll(() => document.querySelector(READY)?.getAttribute('data-tool')).toBe('eraser')
    await page.viewport(size.height, size.width)
    await settleLayout()
    expect(document.querySelector(READY)?.getAttribute('data-tool')).toBe('eraser')
    noPageScroll()
  })
})

describe.each(SIZES.filter((size) => size.width >= 1100))(
  'Suite Characters 2D at $name ($width x $height)',
  (size) => {
    test('a stepper in the inspector keeps its minus, number and plus on one line', async () => {
      opened = await openSuite(size, editors(), FILES, '[data-testid="entities-inspector"]', 'Characters')
      const steppers = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="entities-inspector"] [data-widget="stepper"]',
        ),
      ]
      expect(steppers.length).toBeGreaterThan(0)
      for (const stepper of steppers) {
        stepper.scrollIntoView({ block: 'nearest' })
        await settleLayout()
        const parts = [...stepper.querySelectorAll<HTMLElement>('button, [role="spinbutton"]')]
        expect(parts).toHaveLength(3)
        const tops = parts.map((part) => part.getBoundingClientRect().top)
        expect(Math.max(...tops) - Math.min(...tops), stepper.textContent ?? '').toBeLessThan(2)
        for (const part of parts) expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(size.width)
      }
    })
  },
)
