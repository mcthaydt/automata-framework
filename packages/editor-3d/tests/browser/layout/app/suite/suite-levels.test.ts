import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import {
  dockToggle,
  editorControl,
  editorList,
  inShell,
  inView,
  noPageScroll,
  type OpenedSuite,
  openSuite,
} from '@automata/editor/suite/testing/layout'
import { checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// The 3D level editor in the suite's one shell with the production CSS in real browsers at the sizes of spec §10: its
// plan sits inside the shell under one top bar, every target is at least 44 px and the page never scrolls. The plan
// draws to a fake renderer: pixels are this package's own canvas project. The 2D editor's twin is in editor.

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af-sector.json', 'levels-3d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/depot.af-sector.json': depot,
}

const renderer: PlanRendererFactory = async () => ({
  paused: {
    subscribe: (run: (value: boolean) => void) => {
      run(false)
      return () => {}
    },
  },
  draw: () => {},
  resize: () => {},
  destroy: () => {},
})

const editors = (): SuiteEditor<unknown>[] => [
  fixtureEditor as SuiteEditor<unknown>,
  createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
]

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

describe.each(SIZES)('Suite Levels 3D at $name ($width x $height)', (size) => {
  test('fills the one shell: the plan in view, every target 44 px, no page scroll', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="plan-canvas"]', 'Levels 3D')
    const plan = inShell('[data-testid="plan-canvas"]')
    inView(plan, size)
    expect(checkLayout(opened.conditions, [plan, editorControl('Levels 3D')])).toEqual([])
    // Levels 3D has no dock, so there is nothing for the toggle to open.
    expect(dockToggle()).toHaveLength(0)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-levels-3d-${size.name}.png` })
  })

  test('the drawing tools are in the top bar, each by role and name, whole and 44 px, and a tap chooses one', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="plan-canvas"]', 'Levels 3D')
    const bar = inShell('[data-region="topbar"]')
    const toolbar = bar.querySelector<HTMLElement>('[role="toolbar"][aria-label="Tools"]')
    if (toolbar === null) throw new Error('the top bar has no Tools')
    const buttons = [...toolbar.querySelectorAll<HTMLElement>('button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Select',
      'Sector',
      'Vertex',
      'Portal',
      'Door',
      'Window',
      'Things',
    ])
    for (const button of buttons) {
      // The top bar scrolls sideways where a phone's width holds too few; each tool is whole once scrolled to.
      button.scrollIntoView({ inline: 'nearest', block: 'nearest' })
      const box = button.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.left).toBeGreaterThanOrEqual(-0.5)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
    }
    const sector = buttons[1] as HTMLElement
    sector.click()
    await expect.poll(() => sector.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false')
    noPageScroll()
  })
})
