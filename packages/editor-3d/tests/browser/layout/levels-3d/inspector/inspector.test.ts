import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { fitInto, planViewport, toScreen } from '#src/features/levels-3d/plan/plan-viewport.ts'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

// The inspector with the production CSS in Chromium, WebKit and Firefox (plan ED3D.5f step 8; ED3D spec §9, §10): at
// `wide` the selected room's card in the inspector column, every control on screen at full size once scrolled to; below
// it the tool strip over the plan's foot, clear of the status line, and the sheet's tabs at full size. A room is selected
// with a finger's tap on the plan, as a person would.

afterEach(stopEditor)

async function openDepot(size: EditorSize, text: string = depotText) {
  const started = await startAt(size, async (workspace) => {
    await workspace.store.write('depot/depot.json', text)
  })
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  document
    .querySelector<HTMLElement>('[role="option"]')
    ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  await arrived()
  return started
}

/** The depot with a camera `start` that draws the dock, and the hall on it, so the hall's card has the rooms' checklist. */
const depotWithCamera = (): string => {
  const level = JSON.parse(depotText) as { views?: unknown; sectors: { id: string; view?: string }[] }
  level.views = { start: { rooms: ['dock'] } }
  for (const sector of level.sectors) sector.view = 'start'
  return JSON.stringify(level)
}

const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''

/**
 * Taps across the plan with a finger until a room or a wall is selected (`only` narrows it: the camera's rooms are on a
 * room's card, and a tap near a wall selects the wall, which depends on how wide the shell leaves the plan).
 */
async function tapARoom(only: RegExp = /(Room|Wall) .+ selected/): Promise<void> {
  const plan = byTestId('plan-canvas')
  const { left, top, width, height } = plan.getBoundingClientRect()
  for (const fy of [0.45, 0.35, 0.55])
    for (const fx of [0.3, 0.5, 0.7]) {
      for (const type of ['pointerdown', 'pointerup'])
        plan.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: left + width * fx,
            clientY: top + height * fy,
            buttons: type === 'pointerdown' ? 1 : 0,
          }),
        )
      await arrived()
      if (only.test(statusWords())) return
    }
  throw new Error(`no room under the taps: ${statusWords()}`)
}

const statusTop = (): number =>
  document.querySelector('[data-widget="status-line"]')?.getBoundingClientRect().top ??
  Number.POSITIVE_INFINITY

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'the inspector at $name ($width x $height)',
  (size) => {
    test('the selected room’s card: its controls on screen at full size, scrolled to; the strip and sheet below wide', async () => {
      const { conditions } = await openDepot(size)
      await tapARoom()
      // A wide window narrower than 1100 px leaves the plan its width: no inspector column; the status line names the room.
      if (size.mode === 'wide' && size.width < 1100) {
        expect(document.querySelector('[data-testid="inspector"]')).toBeNull()
        expect(statusWords()).toMatch(/(Room|Wall) .+ selected/)
        return
      }
      const inspector = byTestId('inspector')
      const controls = [
        ...inspector.querySelectorAll<HTMLElement>('button, [role="spinbutton"], [role="slider"]'),
      ]
      expect(controls.length).toBeGreaterThan(3)
      const problems: string[] = []
      for (const control of controls) {
        if (control.hasAttribute('disabled')) continue
        control.scrollIntoView({ block: 'nearest' })
        await arrived()
        problems.push(...checkLayout(conditions, [control]))
      }
      expect(problems).toEqual([])
      if (size.mode === 'wide') return
      const strip = byTestId('tool-strip')
      expect(checkLayout(conditions, [...strip.querySelectorAll<HTMLElement>('button')])).toEqual([])
      expect(strip.getBoundingClientRect().bottom).toBeLessThanOrEqual(statusTop())
      const tabs = [...byTestId('portrait-sheet').querySelectorAll<HTMLElement>('[role="tab"]')]
      tabs[0]?.scrollIntoView({ block: 'nearest' })
      await arrived()
      expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Sector', 'Walls', 'Things', 'Checks'])
      expect(checkLayout(conditions, tabs)).toEqual([])
    })
  },
)

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'the camera’s rooms in the inspector at $name ($width x $height)',
  (size) => {
    test('each room to tick is a whole touch target on screen, scrolled to', async () => {
      const { conditions } = await openDepot(size, depotWithCamera())
      await tapARoom(/Room .+ selected/)
      // As above: a wide window under 1100 px has no inspector column.
      if (size.mode === 'wide' && size.width < 1100) return
      const group = byTestId('inspector').querySelector<HTMLElement>('[aria-label="Rooms this camera draws"]')
      expect(group).not.toBeNull()
      const labels = [...(group?.querySelectorAll<HTMLElement>('label') ?? [])]
      expect(labels.map((label) => label.textContent?.trim())).toEqual(['hall', 'dock'])
      const problems: string[] = []
      for (const label of labels) {
        label.scrollIntoView({ block: 'nearest' })
        await arrived()
        problems.push(...checkLayout(conditions, [label]))
      }
      expect(problems).toEqual([])
    })
  },
)

// v2's sidebar is 224 px at `wide` (main's rail was 56), so with the panel and the inspector beside it the plan is
// 378 px wide at 1194 and 554 at 1366. These pin what is true today so it cannot get worse unseen: the plan keeps that
// width wherever the inspector shows beside it, and a room in it is still reached by a tap at its centre.
const PLAN_WIDTH_FLOOR = 378

describe.each(SIZES.filter((size) => size.mode === 'wide' && size.width >= 1100))(
  'the plan beside the inspector at $name ($width x $height)',
  (size) => {
    test('keeps its width, and a tap at the middle of each room selects that room', async () => {
      await openDepot(size)
      const plan = byTestId('plan-canvas')
      const box = plan.getBoundingClientRect()
      expect(box.width, 'the plan is not squeezed by the columns around it').toBeGreaterThanOrEqual(
        PLAN_WIDTH_FLOOR,
      )
      expect(
        document.querySelector('[data-testid="inspector"]'),
        'the inspector shows beside the plan',
      ).not.toBeNull()
      // Where the level puts each room's middle on the canvas, by the plan's own fit and viewport (the fixture's two
      // rooms are 8 x 6 m and 6 x 6 m side by side, so the level is 14 x 6 m from the origin).
      const [x, y, w, h] = (plan.dataset.usable ?? '').split(' ').map(Number)
      const canvas = { w: box.width, h: box.height }
      const camera = fitInto(
        { x: 0, y: 0, w: 14, h: 6 },
        { x: x ?? 0, y: y ?? 0, w: w ?? canvas.w, h: h ?? canvas.h },
        canvas,
      )
      const viewport = planViewport(camera, canvas)
      for (const [room, middle] of [
        ['hall', { x: 4, z: 3 }],
        ['dock', { x: 11, z: 3 }],
      ] as const) {
        const at = toScreen(viewport, middle)
        for (const type of ['pointerdown', 'pointerup'])
          plan.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: 'touch',
              isPrimary: true,
              clientX: box.left + at.x,
              clientY: box.top + at.y,
              buttons: type === 'pointerdown' ? 1 : 0,
            }),
          )
        await arrived()
        expect(statusWords(), `a tap at the middle of ${room}`).toContain(`Room ${room} selected`)
      }
    })
  },
)
