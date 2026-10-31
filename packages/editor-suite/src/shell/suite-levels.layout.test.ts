import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, type PlanRendererFactory } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../core'
import { fixtureEditor } from '../testing/fixture-editor'
import depot from '../testing/fixtures/depot.af-sector.json?raw'
import platformer from '../testing/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '../testing/StandInLevelCanvas.svelte'
import { samplePorts } from '../testing/sample-ports'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

// The level editors in the suite's one shell with the production CSS in real browsers at the sizes of spec §10 (plan
// EDS.2d step 7): their regions sit inside the shell under one top bar, every target is at least 44 px, the page never
// scrolls, and a rotation keeps the session (the level's layer and the plan's selection survive the viewport change).
// The canvases are stand-ins (the 2D one shows what it is handed; the 3D plan draws to a fake renderer): pixels are
// the editors' own canvas projects.

const row = (glob: string, editor: string) =>
  `[[file]]\nglob = "${glob}"\neditor = "${editor}"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
const list = (glob: string, editor: string) =>
  `format = "af-editors/1"\n${row('content/tuning.toml', 'tuner')}\n${row(glob, editor)}`

const TWO_D = {
  [EDITOR_LIST_PATH]: list('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}
const THREE_D = {
  [EDITOR_LIST_PATH]: list('content/levels/*.af-sector.json', 'levels-3d'),
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
  createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
]

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize, files: Record<string, string>, ready: string) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors: editors() }),
  })
  await settleLayout()
  tab('Levels').click()
  await expect.poll(() => document.querySelector(ready)).not.toBeNull()
  await settleLayout()
  return conditions
}

function tab(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} tab`)
  return found
}

function inShell(selector: string): HTMLElement {
  const shells = document.querySelectorAll('[data-editor-shell]')
  expect(shells).toHaveLength(1)
  const found = shells[0]?.querySelector<HTMLElement>(selector)
  if (found === null || found === undefined) throw new Error(`no ${selector} in the shell`)
  return found
}

/** The canvas has real room (the Level view's own bar: a medium dock starts open as a strip over its foot). */
function inView(element: HTMLElement, size: EditorSize): void {
  const box = element.getBoundingClientRect()
  expect(box.width).toBeGreaterThan(size.mode === 'wide' && size.width < 1000 ? 240 : size.width / 3)
  expect(box.height).toBeGreaterThan(size.mode === 'compact' && size.height < 500 ? 80 : 200)
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
}

/** The suite's top-bar toggle for the dock, where the dock is a sheet. */
const dockToggle = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('button')].filter(
    (button) => button.textContent?.trim() === 'Dock',
  )

function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
}

describe.each(SIZES)('Suite level editors at $name ($width x $height)', (size) => {
  test('Levels 2D fills the one shell: the stage has room, every target 44 px, a Dock toggle below wide', async () => {
    const conditions = await open(size, TWO_D, '[data-testid="level-canvas"]')
    const surface = inShell('[data-testid="level-surface"]')
    inView(surface, size)
    expect(checkLayout(conditions, [tab('Levels'), ...dockToggle()])).toEqual([])
    if (size.mode !== 'wide') expect(dockToggle()).toHaveLength(1)
    const [toggle] = dockToggle()
    if (toggle?.getAttribute('aria-expanded') === 'true') {
      // A medium dock starts open as a strip over the canvas's foot; the toggle takes it away.
      toggle.click()
      await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('false')
      await settleLayout()
      expect(checkLayout(conditions, [surface, toggle])).toEqual([])
    }
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-levels-2d-${size.name}.png` })
  })

  test('Levels 3D fills the one shell: the plan in view, every target 44 px, no page scroll', async () => {
    const conditions = await open(size, THREE_D, '[data-testid="plan-canvas"]')
    const plan = inShell('[data-testid="plan-canvas"]')
    inView(plan, size)
    expect(checkLayout(conditions, [plan, tab('Levels')])).toEqual([])
    // Levels 3D has no dock, so there is nothing for the toggle to open.
    expect(dockToggle()).toHaveLength(0)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-levels-3d-${size.name}.png` })
  })

  test('a rotation keeps the Levels 2D session: the chosen tool is still chosen', async () => {
    await open(size, TWO_D, '[data-testid="level-canvas"]')
    await page.getByRole('radio', { name: 'Eraser' }).click()
    await expect
      .poll(() => document.querySelector('[data-testid="level-canvas"]')?.getAttribute('data-tool'))
      .toBe('eraser')
    await page.viewport(size.height, size.width)
    await settleLayout()
    expect(document.querySelector('[data-testid="level-canvas"]')?.getAttribute('data-tool')).toBe('eraser')
    noPageScroll()
  })
})
