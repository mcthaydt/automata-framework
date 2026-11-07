import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The Plan view with the production CSS in Chromium, WebKit and Firefox (plan ED3D.5d step 8; 3D editor spec §10 and
// §12) at the kit's eight window sizes: the plan fills its region, the layers are inline at wide and a drawer below
// it, every control is on screen at full size. Then the tablet journey with touch and Pencil samples through the
// page's own Pointer Events: tap a room, drag it with the Pencil (one undo step), rotate (nothing remounts, the
// selection stays), hide the walls.

const DEPOT = 'depot/depot.json'

afterEach(stopEditor)

async function openDepot(size: EditorSize) {
  const started = await startAt(size, async (workspace) => {
    await workspace.store.write(DEPOT, depotText)
  })
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  const card = document.querySelector<HTMLElement>('[role="option"]')
  card?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  await arrived()
  return started
}

const plan = (): HTMLElement => byTestId('plan-canvas')
const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''

/** A pointer event of `kind` at a point of the plan, given in pixels from its top left. */
function pointer(type: string, kind: 'touch' | 'pen', x: number, y: number): void {
  const box = plan().getBoundingClientRect()
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: kind === 'pen' ? 2 : 1,
      pointerType: kind,
      isPrimary: true,
      clientX: box.left + x,
      clientY: box.top + y,
      pressure: type === 'pointerup' ? 0 : 0.5,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  )
}

function tap(kind: 'touch' | 'pen', x: number, y: number): void {
  pointer('pointerdown', kind, x, y)
  pointer('pointerup', kind, x, y)
}

/** Taps across the plan until a room is selected; answers where. */
async function tapARoom(): Promise<{ x: number; y: number }> {
  const { width, height } = plan().getBoundingClientRect()
  for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const at = { x: Math.round(width * fx), y: Math.round(height * fy) }
      tap('touch', at.x, at.y)
      await arrived()
      if (/Room \S+ selected/.test(statusWords())) return at
    }
  }
  throw new Error(`no room under the taps: ${statusWords()}`)
}

const undoLabel = (): string => byTestId('undo').getAttribute('aria-label') ?? ''

describe.each(SIZES)('the Plan view at $name ($width x $height)', (size) => {
  test('the plan fills its region; the layers are inline at wide and a drawer below it; controls at full size', async () => {
    const { conditions } = await openDepot(size)
    const canvas = region('canvas').getBoundingClientRect()
    const box = plan().getBoundingClientRect()
    expect(Math.abs(box.width - canvas.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - canvas.height)).toBeLessThanOrEqual(1)
    expect(box.height).toBeGreaterThan(100)
    if (size.mode === 'wide') {
      // The kit's inline panel (`--shell-panel`); 320 px is the inspector's width (ED3D-D12).
      expect(region('panel').getBoundingClientRect().width).toBe(264)
      expect(document.querySelector('[data-testid="toggle-layers"]')).toBeNull()
    } else {
      byTestId('toggle-layers').click()
      await arrived()
      expect(region('panel').dataset.open).toBe('true')
    }
    expect(checkLayout(conditions, [byTestId('undo'), byTestId('save')])).toEqual([])
    // The layers list is the panel's scroll region: each button is reachable once scrolled to.
    const problems: string[] = []
    for (const button of byTestId('layers-panel').querySelectorAll('button')) {
      button.scrollIntoView({ block: 'nearest' })
      await arrived()
      problems.push(...checkLayout(conditions, [button]))
    }
    expect(problems).toEqual([])
  })

  test('journey: tap a room, drag it with the Pencil as one step, rotate, then hide the walls', async () => {
    await openDepot(size)
    const host = plan()
    const at = await tapARoom()
    // The Pencil drags the selected room (or the corner under it): one step, named on Undo.
    pointer('pointerdown', 'pen', at.x, at.y)
    for (let step = 1; step <= 4; step++) pointer('pointermove', 'pen', at.x + step * 8, at.y + step * 4)
    pointer('pointerup', 'pen', at.x + 32, at.y + 16)
    await arrived()
    expect(undoLabel()).toMatch(/^Undo Move (sector|corner)/)
    const selected = statusWords().match(/Room \S+ selected/)?.[0]
    // Rotation: the plan is the same element and the selection stays.
    await page.viewport(size.height, size.width)
    await arrived()
    expect(plan()).toBe(host)
    expect(statusWords()).toContain(selected)
    // Hide the walls: from the drawer when the panel is not in view.
    const toggle = document.querySelector<HTMLElement>('[data-testid="toggle-layers"]')
    if (toggle !== null && toggle.getAttribute('aria-expanded') !== 'true') {
      toggle.click()
      await arrived()
    }
    const hide = byTestId('layers-panel').querySelector<HTMLElement>('button[aria-label="Hide Walls"]')
    hide?.click()
    await arrived()
    expect(byTestId('layers-panel').querySelector('button[aria-label="Show Walls"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
