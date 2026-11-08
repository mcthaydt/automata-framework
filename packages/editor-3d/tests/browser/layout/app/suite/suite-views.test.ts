import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { arrived, SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import { editorList, type OpenedSuite, openSuite } from '@automata/editor/suite/testing/layout'
import { checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import type { DollhouseRendererFactory } from '#src/features/levels-3d/dollhouse/dollhouse-renderer.ts'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// The three views of a room in the suite (spec 10.3, V1): Plan, 3D and Walk are one control in the top bar, a person
// can change between them at every size, and the room is drawn by the view chosen. The 3D renderers are fakes here:
// what they draw is the canvas project's.

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

const dollhouse: DollhouseRendererFactory = async () => ({
  draw: () => {},
  resize: () => {},
  destroy: () => {},
  paused: {
    subscribe: (run: (value: boolean) => void) => {
      run(false)
      return () => {}
    },
  },
})

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

/** The control that shows a view: a radio of the view control, or on a phone an item of the View menu once it is open. */
const view = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('[role="radio"], [role="menuitem"]')].find(
    (each) => (each.getAttribute('aria-label') ?? each.textContent ?? '').trim().startsWith(name),
  )
  if (found === undefined) throw new Error(`no ${name} view`)
  return found
}

/** Chooses a view the way a person does: one tap on its radio, or on a phone a tap on the View menu and one on its item. */
async function choose(name: string): Promise<void> {
  const menu = document.querySelector<HTMLElement>('button[aria-label="View"]')
  if (menu !== null) {
    menu.click()
    await arrived()
  }
  view(name).click()
  await arrived()
}
const menuButton = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('button[aria-label="View"]')
  if (found === null) throw new Error('no View control')
  return found
}
const shown = (testid: string): boolean => document.querySelector(`[data-testid="${testid}"]`) !== null

describe.each(SIZES)('Views of a room in the suite at $name ($width x $height)', (size) => {
  test('Plan, 3D and Walk are in the top bar, reachable, and each draws its own canvas', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({
          now: () => 0,
          renderer,
          dollhouse,
          schedule: () => () => {},
        }) as SuiteEditor<unknown>,
      ],
      FILES,
      '[data-testid="plan-canvas"]',
      'Levels',
    )
    // A phone's one View button names the view it shows; wider screens show all three.
    const radios = document.querySelectorAll('[role="radio"]').length
    const control =
      radios > 0 ? [...document.querySelectorAll<HTMLElement>('[role="radio"]')] : [menuButton()]
    expect(checkLayout(opened.conditions, control)).toEqual([])
    expect(radios === 3 || size.name.startsWith('phone') || size.width <= 760 || size.height <= 520).toBe(
      true,
    )
    await choose('3D')
    await expect.poll(() => shown('dollhouse-canvas')).toBe(true)
    expect(shown('plan-canvas')).toBe(false)
    await choose('Walk')
    await expect.poll(() => shown('walk-canvas')).toBe(true)
    expect(shown('dollhouse-canvas')).toBe(false)
    await choose('Plan')
    await expect.poll(() => shown('plan-canvas')).toBe(true)
  })
})
