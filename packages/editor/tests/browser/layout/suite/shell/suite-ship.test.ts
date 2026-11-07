import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// Ship, the Review desk and Import with the production CSS in real browsers at the sizes of spec §10: each dialog's
// primary action (Ship, Apply) is reachable at 48 px inside the window, the Review desk's diff stays inside the canvas,
// and the page never scrolls. Screenshots go to .vitest/shots for the review images.
const TUNING = 'content/tuning.toml'
const START = '# How fast the player runs, in metres a second.\nMAX_MOVE_SPEED = 7\nJUMP = 3\n'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit", "ask"]
gates = ["g-feel", "g-speed"]
checks = ["lint"]

[[gate]]
id = "g-feel"
name = "Feel"
records = "docs/gates.json"

[[gate]]
id = "g-speed"
name = "Speed"
records = "docs/gates.json"

[[check]]
id = "lint"
when = "after"
run = ["lint"]
`

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error(JSON.stringify(load.problems))
  const memory = await createMemoryPorts({
    files: { [EDITOR_LIST_PATH]: LIST, [TUNING]: START },
    classify: (path) => workspaceFile(load.list, path),
    checks: [
      {
        id: 'lint',
        when: 'after',
        run: ['lint'],
        joins: [],
        measure: false,
        respond: () => ({ status: 'pass', findings: [], output: '' }),
      },
    ],
    gates: {
      'g-feel': {
        name: 'Feel',
        decision: 'approved',
        decidedAt: '2026-10-20',
        url: 'https://example.com/g-feel',
      },
      'g-speed': { name: 'Speed', decision: 'open', url: 'https://example.com/g-speed' },
    },
    ask: () => ({ summary: 'Raise the top speed to 8', text: START.replace('= 7', '= 8'), tokens: 640 }),
  })
  const changeSet = memory.ports.changeSet
  await changeSet?.begin('Faster player')
  await changeSet?.record([TUNING], [{ path: TUNING, before: START.replace('= 7', '= 6'), after: START }])
  await changeSet?.note([
    {
      check: 'lint',
      status: 'fail',
      findings: [
        { path: TUNING, line: 2, severity: 'error', message: 'MAX_MOVE_SPEED is above the level’s safe run' },
      ],
    },
  ])
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: memory.ports,
    suite: createSuite({ editors: [fixtureEditor as SuiteEditor<unknown>] }),
    // A clock nothing advances: the reload toast stays however slow the runner is (it measures the toast's place).
    clock: createTestClock(),
  })
  await expect.poll(() => document.querySelector('[data-testid="suite-home"]')).not.toBeNull()
  await settleLayout()
  return conditions
}
const button = (name: string, within: ParentNode = document): HTMLElement => {
  const found = [...within.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
}

/** The button's box is at least 48 px tall and inside the window. */
function reachable(name: string, within: ParentNode, size: EditorSize): void {
  const box = button(name, within).getBoundingClientRect()
  expect(box.height, name).toBeGreaterThanOrEqual(targets.primary)
  expect(box.bottom, name).toBeLessThanOrEqual(size.height + 0.5)
  expect(box.right, name).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.left, name).toBeGreaterThanOrEqual(-0.5)
}

const dialogNamed = (name: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.querySelector('h2, [id$="title"]')?.textContent?.trim() === name,
  ) ?? document.querySelector<HTMLElement>('[role="dialog"]')

describe.each(SIZES)('Ship, Review and Import at $name ($width x $height)', (size) => {
  test('the reload toast sits above the rail and the status line, not over them', async () => {
    await open(size)
    await expect.poll(() => document.querySelector('[data-widget="toast-region"] .toast')).not.toBeNull()
    await settleLayout()
    const toast = document
      .querySelector<HTMLElement>('[data-widget="toast-region"] .toast')
      ?.getBoundingClientRect()
    // The rail as a column (wide) is beside the canvas, not under it; as a tab bar it is the foot.
    const foot = [...document.querySelectorAll<HTMLElement>('[data-region="rail"], [data-region="status"]')]
      .filter((region) => region.dataset.presentation !== 'rail')
      .map((region) => region.getBoundingClientRect().top)
    expect(toast?.bottom).toBeLessThanOrEqual(Math.min(size.height, ...foot) + 0.5)
    await page.screenshot({ path: `.vitest/shots/reload-toast-${size.name}.png` })
  })

  test('the Ship dialog: the description and Ship reachable at 48 px', async () => {
    await open(size)
    button('Publish').click()
    await expect.poll(() => document.querySelector('[role="dialog"] textarea')).not.toBeNull()
    await expect
      .poll(() => document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')?.value)
      .toContain(TUNING)
    await settleLayout()
    const dialog = dialogNamed('Publish your changes')
    if (dialog === null) throw new Error('no dialog')
    reachable('Publish', dialog, size)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/ship-dialog-${size.name}.png` })
  })

  test('the Review desk: the diff inside the canvas, the page not scrolled', async () => {
    await open(size)
    const review = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
      tab.textContent?.includes('Review'),
    )
    review?.click()
    await expect
      .poll(() => document.querySelector('[data-testid="review-desk"] [data-kind="added"]'))
      .not.toBeNull()
    await settleLayout()
    const desk = document.querySelector<HTMLElement>('[data-testid="review-desk"]')?.getBoundingClientRect()
    const diff = document
      .querySelector<HTMLElement>('[data-testid="review-desk"] pre')
      ?.getBoundingClientRect()
    expect(diff?.right).toBeLessThanOrEqual((desk?.right ?? 0) + 0.5)
    const rows = [...document.querySelectorAll<HTMLElement>('[data-testid="review-desk"] [data-gate]')]
    expect(rows.map((row) => row.dataset.gate)).toEqual(['g-feel', 'g-speed'])
    for (const row of rows) {
      const link = row.querySelector('a')?.getBoundingClientRect()
      expect(link?.height, `${row.dataset.gate} link`).toBeGreaterThanOrEqual(targets.hit)
      expect(link?.width, `${row.dataset.gate} link`).toBeGreaterThanOrEqual(targets.hit)
    }
    // Each record link sits at the row's right edge, beside its state however that wraps, with one gap between rows.
    const rights = rows.map((row) => row.querySelector('a')?.getBoundingClientRect().right)
    expect(rights[0]).toBeCloseTo(rights[1] ?? 0, 0)
    for (const row of rows) {
      const state = row.querySelector('span')?.getBoundingClientRect()
      const link = row.querySelector('a')?.getBoundingClientRect()
      expect(link?.left, `${row.dataset.gate} link beside its state`).toBeGreaterThanOrEqual(
        (state?.right ?? 0) - 0.5,
      )
    }
    const [feel, speed] = rows.map((row) => row.getBoundingClientRect())
    const gap = (speed?.top ?? 0) - (feel?.bottom ?? 0)
    expect(gap).toBeGreaterThanOrEqual(4)
    expect(gap).toBeLessThanOrEqual(12.5)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/review-desk-${size.name}.png` })
  })

  test('Import: the plan with its diff, and Apply reachable at 48 px', async () => {
    await open(size)
    button('Import').click()
    await expect.poll(() => document.querySelector('[role="dialog"] textarea')).not.toBeNull()
    const dialog = dialogNamed('Import')
    if (dialog === null) throw new Error('no dialog')
    const field = dialog.querySelector<HTMLTextAreaElement>('textarea')
    if (field === null) throw new Error('no field')
    field.value = `format = "scene-interchange"\nversion = 2\n\n[source]\n\n[sections.tuner."${TUNING}"]\nJUMP = 4\nMAX_MOVE_SPEED = 7\n`
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settleLayout()
    button('See changes', dialog).click()
    await expect.poll(() => dialog.querySelector('[data-kind="added"]')).not.toBeNull()
    await settleLayout()
    reachable('Import', dialog, size)
    const chooser = button('Choose a file', dialog).getBoundingClientRect()
    expect(chooser.height).toBeGreaterThanOrEqual(targets.hit)
    expect(chooser.width).toBeGreaterThanOrEqual(targets.hit)
    expect(button('Import', dialog)).not.toHaveProperty('disabled', true)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/interchange-${size.name}.png` })
  })
})
