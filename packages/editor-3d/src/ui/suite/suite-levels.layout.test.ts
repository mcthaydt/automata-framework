import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '@mcthaydt/automata-editor/suite.css'
import { checkLayout } from '@mcthaydt/automata/testing'
import { EDITOR_LIST_PATH } from '@mcthaydt/automata-editor/editor-list'
import type { SuiteEditor } from '@mcthaydt/automata-editor/kit/ports'
import { SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { fixtureEditor } from '@mcthaydt/automata-editor/suite/testing'
import {
  dockToggle,
  editorList,
  inShell,
  inView,
  noPageScroll,
  type OpenedSuite,
  openSuite,
  tab,
} from '@mcthaydt/automata-editor/suite/testing/layout'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import depot from '../../testing/fixtures/depot.af-sector.json?raw'
import { createLevels3d, type PlanRendererFactory } from './index.ts'

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
    expect(checkLayout(opened.conditions, [plan, tab('Levels 3D')])).toEqual([])
    // Levels 3D has no dock, so there is nothing for the toggle to open.
    expect(dockToggle()).toHaveLength(0)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-levels-3d-${size.name}.png` })
  })
})
