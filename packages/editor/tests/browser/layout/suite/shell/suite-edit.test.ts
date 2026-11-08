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
  // The first edit runs the `after` check, which fails, so the header counts one problem.
  button('Raise speed').click()
  // On a phone the count is inside the title's sheet, so the test waits for it there.
  if (size.mode !== 'compact') await expect.poll(() => problemsText()).toBe('1 problem')
  await settleLayout()
  return conditions
}

/** The count's words, from its button in the header. */
const problemsText = (): string | null | undefined =>
  document.querySelector('[data-region="topbar"] .count')?.getAttribute('aria-label')
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
  test('the problem count stays in the header whole (its number alone under 900 px), and its list stays in the window', async () => {
    const conditions = await open(size)
    const compact = size.mode === 'compact'
    let opener: HTMLElement
    if (compact) {
      // A phone has no room for the count in the bar: the title opens a sheet that holds it.
      opener = document.querySelector<HTMLElement>('[data-region="topbar"] .title') as HTMLElement
      expect(opener).not.toBeNull()
    } else {
      opener = document.querySelector<HTMLElement>('[data-region="topbar"] .count') as HTMLElement
      const box = opener.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.left).toBeGreaterThanOrEqual(-0.5)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
      const words = opener.textContent?.replace(/\s+/g, ' ').trim()
      expect(words, 'under 900 px the word goes and the number stays').toBe(
        size.width < 900 ? '1' : '1 problem',
      )
      expect(checkLayout(conditions, [opener])).toEqual([])
    }
    noPageScroll()
    opener.click()
    await expect.poll(() => document.querySelector('section[aria-label="1 problem"]')).not.toBeNull()
    await settleLayout()
    const list = document.querySelector<HTMLElement>('section[aria-label="1 problem"]')
    const listBox = list?.getBoundingClientRect()
    expect(listBox, 'the list is open').toBeDefined()
    expect(listBox?.left).toBeGreaterThanOrEqual(-0.5)
    expect(listBox?.right).toBeLessThanOrEqual(size.width + 0.5)
    expect(listBox?.bottom).toBeLessThanOrEqual(size.height + 0.5)
    expect(button('Locate lint').getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    await page.screenshot({ path: `.vitest/shots/suite-problems-${size.name}.png` })
  })
})
