import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import { chooseEditor } from '#src/testing/suite/suite-layout.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The pills with the production CSS in real browsers at the sizes of spec §10: the pill stays in the top bar at every
// size (an icon with a count in the `short` tier and on a phone, never hidden), every target is at least 44 px and the
// page never scrolls.
const TUNING = 'content/tuning.toml'
const START = '# How fast the player runs, in metres a second.\nMAX_MOVE_SPEED = 7\nJUMP = 3\n'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["lint"]

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
        respond: () => ({
          status: 'fail',
          findings: [
            {
              path: TUNING,
              line: 2,
              severity: 'error',
              message: 'MAX_MOVE_SPEED is above the level’s safe run',
            },
          ],
          output: '',
        }),
      },
    ],
  })
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: memory.ports,
    suite: createSuite({ editors: [fixtureEditor as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  await chooseEditor()
  await expect.poll(() => document.querySelector('[data-testid="fixture-text"]')).not.toBeNull()
  // The first edit runs the `after` check, which fails, so the pill appears (a pill with nothing to say is hidden).
  button('Raise speed').click()
  await expect.poll(() => pillButtons().map((pill) => pill.dataset.tone)).toEqual(['fail'])
  await settleLayout()
  return conditions
}

const pillButtons = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[aria-label="Checks"] > .pill-wrap > button'),
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
  test('the checks pill stays in the top bar, whole and at least 44 px; an icon with a count when short', async () => {
    const conditions = await open(size)
    const pills = pillButtons()
    expect(pills).toHaveLength(1)
    const bar = pills[0]?.closest('header, [data-region="topbar"]') ?? pills[0]?.parentElement?.parentElement
    const barBox = bar?.getBoundingClientRect()
    for (const pill of pills) {
      const box = pill.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.left).toBeGreaterThanOrEqual(-0.5)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
      if (barBox !== undefined) expect(box.top).toBeGreaterThanOrEqual(barBox.top - 0.5)
    }
    const icons =
      document.documentElement.dataset.height === 'short' ||
      document.querySelector('[data-editor-shell]')?.getAttribute('data-mode') === 'compact'
    if (icons) expect(pills.map((pill) => pill.textContent?.replace(/\s+/g, ''))).toEqual(['✓1'])
    expect(checkLayout(conditions, [...pills])).toEqual([])
    noPageScroll()
    pills[0]?.click()
    await settleLayout()
    const list = document.querySelector<HTMLElement>('section[aria-label="lint failed"]')
    const listBox = list?.getBoundingClientRect()
    expect(listBox?.right).toBeLessThanOrEqual(size.width + 0.5)
    expect(listBox?.bottom).toBeLessThanOrEqual(size.height + 0.5)
    expect(button('Locate lint').getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    await page.screenshot({ path: `.vitest/shots/suite-pills-${size.name}.png` })
    pills[0]?.click()
    noPageScroll()
  })
})
