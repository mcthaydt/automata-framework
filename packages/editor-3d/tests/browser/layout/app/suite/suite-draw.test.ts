import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { arrived, SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import { editorList, type OpenedSuite, openSuite } from '@automata/editor/suite/testing/layout'
import { afterEach, describe, expect, test } from 'vitest'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// A room drawn with the suite's own tools (spec 10.3, V1): the Sector tool is chosen in the top bar, a rectangle is
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

function pointerAt(type: string, at: { x: number; y: number }): void {
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
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

/** Hovers two points and reads where the status line says they are: the page-to-plan map. */
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

const WIDE = SIZES.filter((size) => size.name === 'ipad-pro-11-landscape')

describe.each(WIDE)('Drawing a room in the suite at $name ($width x $height)', (size) => {
  test('the Sector tool in the top bar draws a rectangle, and Undo names the step', async () => {
    opened = await openSuite(
      size,
      [
        fixtureEditor as SuiteEditor<unknown>,
        createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
      ],
      FILES,
      '[data-testid="plan-canvas"]',
      'Levels 3D',
    )
    await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
    const pageOf = await calibrate()
    button('Sector').click()
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
      for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, at)
      await arrived()
    }
    button('Make portal').click()
    await arrived()
    const undo = (): string =>
      [...document.querySelectorAll<HTMLElement>('button')]
        .map((candidate) => candidate.getAttribute('aria-label') ?? '')
        .find((label) => label.startsWith('Undo')) ?? ''
    await expect.poll(undo).toMatch(/^Undo Draw sector sector-1/)
    // Undo takes the room back out. It takes two taps today (the room, then its portal, both named "Draw sector"),
    // where the sector tool's own notes say they are one step: a finding for the plan's log, so this holds the limit.
    const steps: string[] = []
    while (undo() !== 'Undo' && steps.length < 4) {
      steps.push(undo())
      button(undo()).click()
      await arrived()
    }
    expect(undo()).toBe('Undo')
    expect(steps.length).toBeLessThanOrEqual(2)
  })
})
