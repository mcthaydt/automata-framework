import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../../main.css'
import { arrived, type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '../../../app/boot'
import { counterIds } from '../../../model/ids'
import { memoryWorkspace } from '../../../testing/memory-workspace'
import { createTestClock } from '../../../testing/test-clock'
import { setCourseTuning } from '../commands/identity-edits'
import { floorFiftyStage } from '../floorfifty-stage'
import { simpleCityTemplate } from '../templates/stage-templates'

// The Stage view with the production CSS in a real browser (plan EDFF.2a-1 step 5; 2D editor spec §12), at the kit's
// eight window sizes in Chromium, WebKit and Firefox: every field, stepper, check box and button at least 44 px tall,
// reachable inside the window when scrolled to in its region, and the page never scrolling. The editor starts as
// `main.ts` starts it, over a memory workspace with a Simple city stage that overrides one tunable.

const STAGE = 'night-market.toml'

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function start(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const stage = setCourseTuning(simpleCityTemplate.create(counterIds()), 'MAX_MOVE_SPEED', 400)
  await workspace.store.write(STAGE, floorFiftyStage.print('', stage))
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startEditor(target, {
    window,
    document,
    workspace,
    clock: {
      now: () => Date.now(),
      setTimer: (ms, run) => window.setTimeout(run, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    },
    fillRandom: (bytes) => {
      crypto.getRandomValues(bytes)
    },
  })
  await settleLayout()
  const card = document.querySelector<HTMLElement>('[role="option"]')
  if (card === null) throw new Error('no stage card')
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[role="tablist"][aria-label="Views"]')).not.toBeNull()
  const tab = [
    ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
  ].find((candidate) => candidate.textContent?.trim() === 'Stage')
  if (tab === undefined) throw new Error('no Stage tab')
  tab.click()
  await expect.poll(() => document.querySelector('[data-testid="stage-view"]')).not.toBeNull()
  await arrived()
  return { conditions }
}

/** Scrolls a control into its region, as a person would, and checks it is a full-size target inside the window. */
async function expectTarget(control: HTMLElement, size: EditorSize): Promise<void> {
  control.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  await settleLayout()
  const box = control.getBoundingClientRect()
  expect(box.height, control.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.top).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
}

describe.each(SIZES)('Stage view at $name ($width x $height)', (size) => {
  test('every control is a full-size target in reach, and the page never scrolls', async () => {
    const { conditions } = await start(size)
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    expect(checkLayout(conditions, tabs)).toEqual([])
    const view = byTestId('stage-view')
    const controls = [
      ...view.querySelectorAll<HTMLElement>('input[type="text"], select, button, [role="spinbutton"]'),
      ...[...view.querySelectorAll<HTMLElement>('input[type="checkbox"]')].map(
        (box) => box.closest('label') as HTMLElement,
      ),
    ]
    expect(controls.length).toBeGreaterThan(10)
    for (const control of controls) await expectTarget(control, size)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    view.querySelector('[data-scroll-region]')?.scrollTo(0, 0)
    await settleLayout()
    await page.screenshot({ path: `.vitest/shots/stage-view-${size.name}.png` })
  })
})
