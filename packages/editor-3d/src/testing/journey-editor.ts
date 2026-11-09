import { arrived, createPointers, type IpadProfile, type Pointers } from '@automata/editor/kit/testing'
import { byTestId } from '@automata/framework/testing'
import { expect } from 'vitest'
import { page } from 'vitest/browser'
import depotText from './fixtures/depot.af-sector.json?raw'
import { startAt } from './layout-start'
import type { MemoryWorkspace } from './memory-workspace'

// The 3D editor on an iPad for the ED3D.11 journeys (the kit's EDK.6b harness): the app over a memory workspace holding
// the depot, at the iPad's window size, with the plan's surface driven by real pointer events (a finger, the Pencil, a
// palm). Plan metres become element pixels through the status line's pointer read-out, as the layout journeys do, so a
// journey says "tap the dock's corner" and not a pixel.

export interface JourneyEditor {
  readonly workspace: MemoryWorkspace
  /** The plan canvas. */
  plan(): HTMLElement
  /** Pointers on the plan canvas. */
  pointers(): Pointers
  /** Measures where plan metres are on the page now: after the window turns, or the camera moves. */
  calibrate(): Promise<void>
  /** The plan point (metres) as a point in the plan canvas's own pixels. */
  at(x: number, z: number): { x: number; y: number }
}

const sizeOf = (profile: IpadProfile) => ({
  name: profile.name,
  width: profile.width,
  height: profile.height,
  mode: profile.width >= 900 && profile.width > profile.height ? ('wide' as const) : ('medium' as const),
  formFactor: profile.width > profile.height ? ('desktop' as const) : ('tablet-portrait' as const),
  heightTier: undefined,
  group: 'tablet' as const,
})

/** Opens the depot in the editor at `profile`'s window, on the plan. */
export async function openDepotJourney(profile: IpadProfile): Promise<JourneyEditor> {
  await page.viewport(profile.width, profile.height)
  const { workspace } = await startAt(sizeOf(profile), async (space) => {
    await space.store.write('depot/depot.json', depotText)
  })
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  document
    .querySelector<HTMLElement>('[role="option"]')
    ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  await arrived()

  const plan = (): HTMLElement => byTestId('plan-canvas')
  let calibration:
    | {
        readonly px: readonly [{ x: number; y: number }, { x: number; y: number }]
        readonly m: readonly [{ x: number; z: number }, { x: number; z: number }]
      }
    | undefined

  const statusPoint = (): { x: number; z: number } => {
    const words = document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent ?? ''
    const read = (axis: 'x' | 'z') =>
      Number(new RegExp(`${axis} (\\S+) m`).exec(words)?.[1]?.replace('−', '-'))
    return { x: read('x'), z: read('z') }
  }

  const measure = async (): Promise<void> => {
    const box = plan().getBoundingClientRect()
    const px = [
      { x: box.width * 0.25, y: box.height * 0.25 },
      { x: box.width * 0.75, y: box.height * 0.75 },
    ] as const
    const m: { x: number; z: number }[] = []
    for (const at of px) {
      // Two hovers: the first move after a screenshot or a turn may not draw the footprint.
      await createPointers(plan()).pencilHover([at])
      await arrived()
      await createPointers(plan()).pencilHover([{ x: at.x + 1, y: at.y + 1 }])
      await arrived()
      m.push(statusPoint())
    }
    calibration = { px, m: m as [{ x: number; z: number }, { x: number; z: number }] }
  }
  const agree = (a: NonNullable<typeof calibration>, b: NonNullable<typeof calibration>): boolean =>
    a.m.every((point, index) => {
      const other = b.m[index]
      return other !== undefined && Math.abs(point.x - other.x) < 0.1 && Math.abs(point.z - other.z) < 0.1
    })

  const journey: JourneyEditor = {
    workspace,
    plan,
    pointers: () => createPointers(plan()),
    async calibrate() {
      // The plan may still be settling after a turn (the camera refits a frame or two late): measure until two
      // measurements in a row agree.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const before = calibration
        await measure()
        const now = calibration
        if (before !== undefined && now !== undefined && agree(before, now)) return
      }
    },
    at(x, z) {
      if (calibration === undefined) throw new Error('not calibrated')
      const [p0, p1] = calibration.px
      const [m0, m1] = calibration.m
      return {
        x: p0.x + ((x - m0.x) * (p1.x - p0.x)) / (m1.x - m0.x),
        y: p0.y + ((z - m0.z) * (p1.y - p0.y)) / (m1.z - m0.z),
      }
    },
  }
  await journey.calibrate()
  return journey
}

/** A tool button of the rail, by its name. */
export function chooseTool(name: string): void {
  const rail = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Tools"]')
  ;[...(rail?.querySelectorAll<HTMLElement>('button') ?? [])]
    .find((button) => button.textContent?.trim() === name)
    ?.click()
}

/** A button anywhere on the page, by its accessible name or text. */
export function buttonNamed(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

export const undoLabel = (): string => byTestId('undo').getAttribute('aria-label') ?? ''

export function chooseView(name: string): void {
  ;[...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="View"] [role="radio"]')]
    .find((each) => each.textContent?.trim() === name)
    ?.click()
}

/** The accessible name of a control as a reader says it: its label, text or the elements that name it. */
function nameOf(control: HTMLElement): string {
  const labelled = control.getAttribute('aria-labelledby')
  const byIds =
    labelled === null
      ? ''
      : labelled
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
  const wrapped = control.closest('label')?.textContent?.trim() ?? ''
  return (
    control.getAttribute('aria-label')?.trim() ||
    byIds.trim() ||
    (control instanceof HTMLInputElement ? (control.labels?.[0]?.textContent?.trim() ?? '') : '') ||
    wrapped ||
    control.textContent?.trim() ||
    control.getAttribute('title')?.trim() ||
    ''
  )
}

/** The controls on the page a screen reader would meet with no name (the a11y check of ED3D.11). */
export function unnamedControls(): string[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      'button, input:not([type="hidden"]), select, textarea, [role="radio"], [role="slider"], [role="spinbutton"], [role="tab"]',
    ),
  ]
    .filter((control) => nameOf(control) === '')
    .map((control) => control.outerHTML.slice(0, 120))
}
