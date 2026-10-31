import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import { fixtureEditor } from '../testing/fixture-editor'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

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
  const conditions = publishConditions(document.documentElement, size, REST)
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
  expect(box.height, name).toBeGreaterThanOrEqual(48)
  expect(box.bottom, name).toBeLessThanOrEqual(size.height + 0.5)
  expect(box.right, name).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.left, name).toBeGreaterThanOrEqual(-0.5)
}

const dialogNamed = (name: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (dialog) => dialog.querySelector('h2, [id$="title"]')?.textContent?.trim() === name,
  ) ?? document.querySelector<HTMLElement>('[role="dialog"]')

describe.each(SIZES)('Ship, Review and Import at $name ($width x $height)', (size) => {
  test('the Ship dialog: the description and Ship reachable at 48 px', async () => {
    await open(size)
    button('Ship').click()
    await expect.poll(() => document.querySelector('[role="dialog"] textarea')).not.toBeNull()
    await expect
      .poll(() => document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')?.value)
      .toContain(TUNING)
    await settleLayout()
    const dialog = dialogNamed('Ship this change')
    if (dialog === null) throw new Error('no dialog')
    reachable('Ship', dialog, size)
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
      expect(link?.height, `${row.dataset.gate} link`).toBeGreaterThanOrEqual(44)
      expect(link?.width, `${row.dataset.gate} link`).toBeGreaterThanOrEqual(44)
    }
    // One gap between gate rows, however each row wraps.
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
    button('Plan', dialog).click()
    await expect.poll(() => dialog.querySelector('[data-kind="added"]')).not.toBeNull()
    await settleLayout()
    reachable('Apply', dialog, size)
    const chooser = button('Choose a file', dialog).getBoundingClientRect()
    expect(chooser.height).toBeGreaterThanOrEqual(44)
    expect(chooser.width).toBeGreaterThanOrEqual(44)
    expect(button('Apply', dialog)).not.toHaveProperty('disabled', true)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/interchange-${size.name}.png` })
  })
})
