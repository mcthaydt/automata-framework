import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import { fixtureEditor } from '../testing/fixture-editor'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

// The pills and the Ask diff dialog with the production CSS in real browsers at the sizes of spec §10: the pills stay
// in the top bar at every size (icons with counts in the `short` tier and on a phone, never hidden), every target is
// at least 44 px, the dialog's Accept and Reject are reachable at 48 px, and the page never scrolls.
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
  await settleLayout()
  document.querySelector<HTMLElement>('[role="tab"]')?.click()
  await expect.poll(() => document.querySelector('[data-testid="fixture-text"]')).not.toBeNull()
  await expect.poll(() => pillButtons().map((pill) => pill.dataset.tone)).toEqual(['neutral', 'fail', 'warn'])
  await settleLayout()
  return conditions
}

const pillButtons = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[aria-label="Change set and checks"] > .pill-wrap > button'),
]
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

describe.each(SIZES)('Suite editing at $name ($width x $height)', (size) => {
  test('the three pills stay in the top bar, whole and at least 44 px; icons with counts when short', async () => {
    const conditions = await open(size)
    const pills = pillButtons()
    expect(pills).toHaveLength(3)
    const bar = pills[0]?.closest('header, [data-region="topbar"]') ?? pills[0]?.parentElement?.parentElement
    const barBox = bar?.getBoundingClientRect()
    for (const pill of pills) {
      const box = pill.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.left).toBeGreaterThanOrEqual(-0.5)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
      if (barBox !== undefined) expect(box.top).toBeGreaterThanOrEqual(barBox.top - 0.5)
    }
    const icons =
      document.documentElement.dataset.height === 'short' ||
      document.querySelector('[data-editor-shell]')?.getAttribute('data-mode') === 'compact'
    if (icons) expect(pills.map((pill) => pill.textContent?.replace(/\s+/g, ''))).toEqual(['⎇1', '✓1', '⚑2'])
    expect(
      checkLayout(conditions, [...pills, button(pills[1]?.getAttribute('aria-label') ?? 'lint failed')]),
    ).toEqual([])
    noPageScroll()
    pills[1]?.click()
    await settleLayout()
    const list = document.querySelector<HTMLElement>('section[aria-label="lint failed"]')
    const listBox = list?.getBoundingClientRect()
    expect(listBox?.right).toBeLessThanOrEqual(size.width + 0.5)
    expect(listBox?.bottom).toBeLessThanOrEqual(size.height + 0.5)
    expect(button('Locate lint').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: `.vitest/shots/suite-pills-${size.name}.png` })
    pills[1]?.click()
    noPageScroll()
  })

  test('the Ask diff dialog fits: Accept and Reject reachable at 48 px, the diff inside the window', async () => {
    await open(size)
    button('Ask').click()
    await expect.poll(() => document.querySelector('[role="dialog"] textarea')).not.toBeNull()
    const prompt = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')
    if (prompt === null) throw new Error('no prompt')
    prompt.value = 'A little faster on flat ground'
    prompt.dispatchEvent(new Event('input', { bubbles: true }))
    await settleLayout()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog === null) throw new Error('no dialog')
    button('Ask', dialog).click()
    await expect.poll(() => dialog.querySelector('[data-kind="added"]')).not.toBeNull()
    await settleLayout()
    for (const name of ['Accept', 'Reject']) {
      const box = button(name, dialog).getBoundingClientRect()
      expect(box.height, name).toBeGreaterThanOrEqual(48)
      expect(box.bottom, name).toBeLessThanOrEqual(size.height + 0.5)
      expect(box.right, name).toBeLessThanOrEqual(size.width + 0.5)
      expect(box.left, name).toBeGreaterThanOrEqual(-0.5)
    }
    const diff = dialog
      .querySelector<HTMLElement>('section[aria-label="Proposed change"]')
      ?.getBoundingClientRect()
    expect(diff?.right).toBeLessThanOrEqual(size.width + 0.5)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/ask-diff-${size.name}.png` })
  })
})
