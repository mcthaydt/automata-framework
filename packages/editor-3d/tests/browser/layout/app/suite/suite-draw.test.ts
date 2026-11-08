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
import { page } from 'vitest/browser'
import barrelProp from '#src/app/suite/sample-3d/content/world-props/barrel.toml?raw'
import crateProp from '#src/app/suite/sample-3d/content/world-props/crate.toml?raw'
import hall from '#src/app/suite/sample-3d/hall.af-sector.json?raw'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// A room drawn with the suite's own tools (spec 10.3, V1): the Room tool is chosen in the top bar, a rectangle is
// tapped out on the plan, and the top bar's Undo names the step. Plan points become page points through the status
// line's pointer read-out, as the standalone draw journeys do. The plan draws to a fake renderer.

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

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

const plan = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
  if (found === null) throw new Error('no plan')
  return found
}

type Finger = 'mouse' | 'touch'

function pointerAt(type: string, at: { x: number; y: number }, pointerType: Finger = 'mouse'): void {
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType,
      isPrimary: true,
      clientX: at.x,
      clientY: at.y,
      pressure: type === 'pointerup' ? 0 : 0.5,
      buttons: type === 'pointerdown' ? 1 : 0,
    }),
  )
}

/** The status line's pointer read-out, in metres; it prints a true minus sign. */
function statusPoint(): { x: number; z: number } {
  const words = document.querySelector('p.status')?.textContent ?? ''
  const read = (axis: 'x' | 'z') => Number(new RegExp(`${axis} (\\S+) m`).exec(words)?.[1]?.replace('−', '-'))
  return { x: read('x'), z: read('z') }
}

/** Hovers two points (with a mouse: a finger cannot hover, and the geometry is the same) and reads where the status line says they are: the page-to-plan map. */
async function calibrate(): Promise<(x: number, z: number) => { x: number; y: number }> {
  const box = plan().getBoundingClientRect()
  const pages = [
    { x: box.left + box.width * 0.25, y: box.top + box.height * 0.25 },
    { x: box.left + box.width * 0.75, y: box.top + box.height * 0.75 },
  ] as const
  const metres: { x: number; z: number }[] = []
  for (const at of pages) {
    const before = statusPoint()
    pointerAt('pointermove', at)
    await arrived()
    await expect
      .poll(() => {
        const read = statusPoint()
        return (
          Number.isFinite(read.x) && Number.isFinite(read.z) && (read.x !== before.x || read.z !== before.z)
        )
      })
      .toBe(true)
    metres.push(statusPoint())
  }
  const [p0, p1] = pages
  const [m0, m1] = metres as [{ x: number; z: number }, { x: number; z: number }]
  return (x, z) => ({
    x: p0.x + ((x - m0.x) * (p1.x - p0.x)) / (m1.x - m0.x),
    y: p0.y + ((z - m0.z) * (p1.y - p0.y)) / (m1.z - m0.z),
  })
}

const button = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

const FINGERS: readonly Finger[] = ['mouse', 'touch']
const CASES = SIZES.flatMap((size) =>
  FINGERS.map((finger) => ({ size, finger, label: `${size.name} by ${finger}` })),
)

describe.each(CASES)('Drawing a room in the suite at $label', ({ size, finger }) => {
  test('the Room tool in the top bar draws a rectangle, and Undo names the step', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
      ],
      FILES,
      '[data-testid="plan-canvas"]',
      'Levels',
    )
    await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
    const pageOf = await calibrate()
    button('Room').click()
    await arrived()
    button('Rectangle').click()
    await arrived()
    // The same corners as the standalone journey's ED3-c, against the dock's south wall; a rectangle closes on a tap on
    // its second corner.
    for (const [x, z] of [
      [8, 6],
      [14, 7.5],
      [14, 7.5],
    ] as const) {
      const at = pageOf(x, z)
      for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, at, finger)
      await arrived()
    }
    button('Make portal').click()
    await arrived()
    const undo = (): string =>
      [...document.querySelectorAll<HTMLElement>('button')]
        .map((candidate) => candidate.getAttribute('aria-label') ?? '')
        .find((label) => label.startsWith('Undo')) ?? ''
    await expect.poll(undo).toMatch(/^Undo Draw sector sector-1/)
    // One Undo takes the room and its portal back out: they are one step, as the sector tool's own notes say.
    const steps: string[] = []
    while (undo() !== 'Undo' && steps.length < 4) {
      steps.push(undo())
      button(undo()).click()
      await arrived()
    }
    expect(undo()).toBe('Undo')
    expect(steps).toHaveLength(1)
  })
})

const pressed = (name: string): boolean => button(name).getAttribute('aria-pressed') === 'true'

function key(name: string, on: EventTarget = document.body): void {
  on.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
}

describe.each(SIZES.filter((size) => size.name === 'ipad-pro-11-landscape'))(
  'The plan tools’ keys in the suite at $name',
  (size) => {
    test('S chooses Room and V goes back to Select, but not while a field has the keys', async () => {
      opened = await openSuite(
        size,
        [
          fixtureEditor as SuiteEditor<unknown>,
          createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
        ],
        FILES,
        '[data-testid="plan-canvas"]',
        'Levels',
      )
      await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
      expect(pressed('Select')).toBe(true)
      key('s')
      await arrived()
      expect(pressed('Room')).toBe(true)
      key('v')
      await arrived()
      expect(pressed('Select')).toBe(true)
      const field = document.createElement('input')
      document.body.append(field)
      field.focus()
      key('s', field)
      await arrived()
      expect(pressed('Select')).toBe(true)
      field.remove()
    })
  },
)

describe.each(CASES)('Placing a thing in the suite at $label', ({ size, finger }) => {
  test('the Things tool shows the game’s things, and a tap in the hall places the one picked', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
      ],
      FILES,
      '[data-testid="plan-canvas"]',
      'Levels',
    )
    await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
    const pageOf = await calibrate()
    button('Thing').click()
    await arrived()
    const palette = document.querySelector<HTMLElement>('[data-testid="things-palette"]')
    if (palette === null) throw new Error('no palette')
    // The depot has its one spawn already, which the palette refuses a second of: the crate is placed.
    const crate = [...palette.querySelectorAll<HTMLElement>('button')].find((each) =>
      each.textContent?.includes('crate'),
    )
    if (crate === undefined) throw new Error('the palette has no crate')
    crate.click()
    await arrived()
    const at = pageOf(3, 3)
    for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, at, finger)
    await arrived()
    const labels = [...document.querySelectorAll<HTMLElement>('button')].map(
      (candidate) => candidate.getAttribute('aria-label') ?? '',
    )
    expect(labels.some((label) => /^Undo Add crate/.test(label))).toBe(true)
  })
})

// The sample game's hall names a crate and a barrel the game defines (`world-props`), which no row of the editor list
// names: the palette still offers them by name, under Furniture.
const GAME_FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af-sector.json', 'levels-3d'),
  'content/levels/hall.af-sector.json': hall,
  'content/world-props/crate.toml': crateProp,
  'content/world-props/barrel.toml': barrelProp,
}

describe.each(CASES)('Placing the game’s furniture in the suite at $label', ({ size, finger }) => {
  test('Crate is under Furniture, a tap in the hall places it, and Undo reads "Undo Add crate"', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
      ],
      GAME_FILES,
      '[data-testid="plan-canvas"]',
      'Levels',
    )
    await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
    const pageOf = await calibrate()
    button('Thing').click()
    await arrived()
    const furniture = document.querySelector<HTMLElement>(
      '[data-testid="things-palette"] [aria-label="Furniture"]',
    )
    if (furniture === null) throw new Error('the palette has no Furniture')
    expect([...furniture.querySelectorAll('button')].map((each) => each.textContent?.trim())).toEqual([
      'Barrel',
      'Crate',
    ])
    // The words on screen never name the definition the editor made for it.
    expect(document.querySelector('[data-testid="things-palette"]')?.textContent).not.toMatch(/prop\./)
    const crate = [...furniture.querySelectorAll<HTMLElement>('button')].find(
      (each) => each.textContent?.trim() === 'Crate',
    )
    if (crate === undefined) throw new Error('the palette has no Crate')
    crate.click()
    await arrived()
    for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, pageOf(4, 3), finger)
    await arrived()
    const labels = [...document.querySelectorAll<HTMLElement>('button')].map(
      (candidate) => candidate.getAttribute('aria-label') ?? '',
    )
    expect(labels).toContain('Undo Add crate')
  })
})

describe.each(CASES)('Changing a room in the suite at $label', ({ size, finger }) => {
  test('a tap on the hall shows its heights in the details, and a step names the Undo', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
      ],
      FILES,
      '[data-testid="plan-canvas"]',
      'Levels',
    )
    await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
    const pageOf = await calibrate()
    const at = pageOf(3, 3)
    for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, at, finger)
    await arrived()
    // Where the details are a sheet, the top bar's Details button opens it.
    const details = document.querySelector<HTMLElement>('button[aria-label="Details"]')
    if (details !== null && details.getAttribute('aria-expanded') !== 'true') {
      details.click()
      await arrived()
    }
    await expect.poll(() => document.querySelector('[aria-label="Increase Floor"]') !== null).toBe(true)
    const card = document.querySelector<HTMLElement>('[data-testid="inspector"]')
    if (card === null) throw new Error('no details')
    await page.screenshot({ path: `.vitest/shots/suite-levels-3d-details-${size.name}-${finger}.png` })
    // Names read left of their controls, as a settings list does: "Light" shares a row with its slider.
    const light = [...card.querySelectorAll<HTMLElement>('span')].find(
      (each) => each.textContent?.trim() === 'Light',
    )
    const slider = card.querySelector<HTMLElement>('[role="slider"]')
    if (light === undefined || slider === null) throw new Error('no Light slider')
    expect(light.getBoundingClientRect().right, 'Light is left of its slider').toBeLessThanOrEqual(
      slider.getBoundingClientRect().left + 1,
    )
    const more = document.querySelector<HTMLElement>('[aria-label="Increase Ceiling"]')
    if (more === null) throw new Error('no ceiling step')
    more.click()
    await arrived()
    const labels = [...document.querySelectorAll<HTMLElement>('button')].map(
      (candidate) => candidate.getAttribute('aria-label') ?? '',
    )
    expect(labels.some((label) => /^Undo Set the heights of/.test(label))).toBe(true)
  })
})
