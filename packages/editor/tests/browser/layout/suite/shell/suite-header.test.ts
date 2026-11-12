import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createMemoryPorts } from '#src/shared/kit/ports/memory/memory-ports.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import type { GamePublish } from '#src/shared/kit/storage/publish-client.ts'
import { type EditorSize, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import {
  chooseEditor,
  editorList,
  noPageScroll,
  type OpenedSuite,
  openSuite,
} from '#src/testing/suite/suite-layout.ts'

// The header with the production CSS in real browsers at every size: Play and Publish are never cut off (Publish 48 px
// with touch), Undo and Redo are whole targets, the problem count keeps its number, and only the title gives way. The
// header scrolls sideways when the editor's own tools leave it short of room, so "present in the page" proves nothing:
// each control must lie whole inside what the header shows.

/** The control sizes under this run's pointer: 32 px with a mouse, 44 with touch. */
const targets = editorTargets()

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}

const publish: GamePublish = {
  publish: async () => ({ ok: false, problem: 'No.', detail: '' }),
  download: async () => {},
}

const editors = (): SuiteEditor<unknown>[] => [
  fixtureEditor as SuiteEditor<unknown>,
  createLevels2d({ ids: { next: () => 'thing' }, canvas: StandInLevelCanvas }) as SuiteEditor<unknown>,
]

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

/** The rectangle of the top bar that a person sees: the whole bar, narrowed to the scrolling tools while the control is inside them. */
function visibleFrame(control: HTMLElement): DOMRect {
  const scroller = control.closest<HTMLElement>('[data-scroll-region]')
  return (
    scroller ??
    control.closest<HTMLElement>('[data-region="topbar"], header') ??
    document.body
  ).getBoundingClientRect()
}

function wholeInView(control: HTMLElement, name: string): void {
  const box = control.getBoundingClientRect()
  const frame = visibleFrame(control)
  expect(box.width, `${name} has a width`).toBeGreaterThan(0)
  expect(box.left, `${name} is not cut off on the left`).toBeGreaterThanOrEqual(Math.max(frame.left, 0) - 0.5)
  expect(box.right, `${name} is not cut off on the right`).toBeLessThanOrEqual(
    Math.min(frame.right, window.innerWidth) + 0.5,
  )
  expect(box.height, `${name} is a target`).toBeGreaterThanOrEqual(32)
}

const byName = (selector: string, name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>(selector)].find(
    (each) => (each.getAttribute('aria-label') ?? each.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name}`)
  return found
}

/** A small phone: the narrowest screen the header is promised to fit. */
const NARROW_PHONE: EditorSize = {
  name: 'phone-narrow',
  width: 360,
  height: 740,
  mode: 'compact',
  formFactor: 'phone-portrait',
  heightTier: undefined,
  group: 'tablet',
}

describe.each([...SIZES, NARROW_PHONE])('The header at $name ($width x $height)', (size) => {
  test('has Play, Publish, Undo, Redo and the problems whole, and Publish the only lime button', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="level-canvas"]', 'Levels', {
      playUrl: 'http://localhost:5199/',
      publish,
    })
    await settleLayout()
    wholeInView(byName('a', 'Play'), 'Play')
    const publishButton = byName('button', 'Publish')
    wholeInView(publishButton, 'Publish')
    expect(publishButton.getBoundingClientRect().height, 'Publish is a primary').toBeGreaterThanOrEqual(
      targets.primary,
    )
    for (const name of ['Undo', 'Redo']) wholeInView(byName('button', name), name)
    // With nothing to count the count is not drawn under 900 px (F5: a tick with no word beside "Saved" reads as a
    // second "saved"), and a phone keeps it inside the title's sheet. From 900 px it shows its words, even at none.
    const count = document.querySelector<HTMLElement>('[data-region="topbar"] .count')
    if (size.mode !== 'compact' && size.width >= 900)
      wholeInView(byName('button', 'Not checked yet'), 'The problem count')
    else expect(count, 'no problem count with no number to show').toBeNull()
    expect(document.querySelectorAll('[data-region="topbar"] [data-kind="primary"]')).toHaveLength(1)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-header-${size.name}.png` })
  })

  test('keeps Play on the bar, off, when the game could not start', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="level-canvas"]', 'Levels', {
      playOff:
        'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.',
      publish,
    })
    await settleLayout()
    const play = byName('button', 'Play')
    expect(play.getAttribute('aria-disabled')).toBe('true')
    wholeInView(play, 'Play')
    wholeInView(byName('button', 'Publish'), 'Publish')
    noPageScroll()
  })
})

// The count's number is what F5 keeps under 900 px: with a problem to count the header shows "1" whole and the words
// stay its accessible name. A phone keeps the count inside the title's sheet (`suite-edit.test.ts` covers that), so
// this runs at the sizes that draw it in the bar.
const LIST = `format = "af-editors/1"
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["lint"]

[[check]]
id = "lint"
when = "after"
run = ["lint"]
`

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'The problem count at $name ($width x $height)',
  (size) => {
    let started: SuiteHandle | undefined
    let target: HTMLElement | undefined
    afterEach(async () => {
      await started?.dispose()
      target?.remove()
    })

    test('with a problem to count shows its number whole under 900 px, and its words as the name', async () => {
      await page.viewport(size.width, size.height)
      const load = loadEditorList(LIST)
      if (!load.ok) throw new Error(JSON.stringify(load.problems))
      const memory = await createMemoryPorts({
        files: { [EDITOR_LIST_PATH]: LIST, 'content/tuning.toml': 'MAX_MOVE_SPEED = 7\n' },
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
              findings: [{ path: 'content/tuning.toml', line: 1, severity: 'error', message: 'Too fast.' }],
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
      // The first edit runs the `after` check, which fails with one finding.
      byName('button', 'Raise speed').click()
      await expect.poll(() => document.querySelector('[data-region="topbar"] .count')).not.toBeNull()
      await settleLayout()
      const count = document.querySelector<HTMLElement>('[data-region="topbar"] .count') as HTMLElement
      wholeInView(count, 'The problem count')
      expect(count.getAttribute('aria-label')).toBe('1 problem')
      expect(count.textContent?.replace(/\s+/g, ' ').trim()).toBe(size.width < 900 ? '1' : '1 problem')
      noPageScroll()
    })
  },
)
