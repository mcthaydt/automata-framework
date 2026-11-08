import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/level-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/level-2d/boot.ts'
import { createAppProfiles } from '#src/app/level-2d/profiles.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The open flows with the production CSS in a real browser: the
// error panel with a long file, the Restore and conflict dialogs, and the document's top bar, at the eight window sizes
// of Home's layout test. jsdom has no layout, so room (inside the screen, target sizes, what covers what, which part
// scrolls) is only checked here. The editor starts as `main.ts` starts it, over a memory workspace.

const PROJECT = 'mossgate.af2d.json'
const BROKEN = 'broken.af2d.json'

/** A file that does not parse: 700 lines, one of them very long, and the JSON stops at line 600, past the first 400. */
function brokenText(): string {
  const lines = ['{', '  "format": "af2d",', '  "version": 1,']
  for (let n = lines.length; n < 599; n += 1) lines.push(`  "k${n}": ${n},`)
  lines.push(`  "long": "${'x'.repeat(400)}"  oops`)
  for (let n = 600; n < 700; n += 1) lines.push(`  "k${n}": ${n},`)
  return `${lines.join('\n')}\n}\n`
}

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

/** Starts the editor at `size` over a workspace with the sample project, a broken file and, if asked, an autosave. */
async function start(size: EditorSize, options: { autosave?: boolean } = {}) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PROJECT, printProject(mossgate()))
  await workspace.store.write(BROKEN, brokenText())
  if (options.autosave) {
    clock.advance(1000)
    const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
    const opened = await app.open(PROJECT)
    if (opened.status !== 'opened') throw new Error(opened.status)
    opened.document.history.apply('Rename', (value) => ({ ...(value as Project), name: 'Mossgate, edited' }))
    clock.advance(1000)
    await opened.document.session.flush()
    opened.document.dispose()
  }
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
  return { conditions, workspace }
}

const OPEN_TIMEOUT_MS = 10_000

/** Opens a level from Home the way a tap on its card does. */
async function openFromHome(path: string): Promise<void> {
  const card = document.querySelector<HTMLElement>(`[aria-label="Levels"] .open[data-path="${path}"]`)
  if (card === null) throw new Error(`no card for ${path}`)
  card.click()
  // The first open in a cold browser can take more than the poll's 1 s default on a loaded runner (Firefox on af-mac
  // missed it at the first size on #301 and #303); the wait is still for the dialog or the document bar to appear.
  await expect
    .poll(() => document.querySelector('[role="dialog"], [data-testid="document-bar"]'), {
      timeout: OPEN_TIMEOUT_MS,
    })
    .not.toBeNull()
  await arrived()
}

const dialog = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[role="dialog"]')
  if (found === null) throw new Error('no dialog')
  return found
}

/** A button by its accessible name: its `aria-label` (an icon button, such as Back) or else its words. */
const button = (root: HTMLElement, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

/** The dialog is wholly on the screen. */
function expectInside(element: HTMLElement, size: EditorSize): void {
  const box = element.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(size.width)
  expect(box.bottom).toBeLessThanOrEqual(size.height)
}

describe.each(SIZES)('open flows at $name ($width x $height)', (size) => {
  test('the error panel: inside the screen, its actions reachable and sized, the text scrolls in itself', async () => {
    const { conditions } = await start(size)
    await openFromHome(BROKEN)
    const panel = dialog()
    expectInside(panel, size)
    const copy = button(panel, 'Copy text')
    const another = button(panel, 'Open another')
    expect(checkLayout(conditions, [copy, another])).toEqual([])
    expect(another.getBoundingClientRect().height, 'Open another is a primary action').toBeGreaterThanOrEqual(
      targets.primary,
    )
    if (size.width >= 700) expect(panel.getBoundingClientRect().width, 'the wide dialog').toBeGreaterThan(600)

    // The innermost scroll region: the dialog's own body is one too, around it.
    const lines = [...panel.querySelectorAll<HTMLElement>('[data-scroll-region]')].at(-1) as HTMLElement
    expect(getComputedStyle(lines).overflowX).toBe('auto')
    expect(getComputedStyle(lines).touchAction).toBe('pan-x pan-y')
    expect(lines.scrollHeight).toBeGreaterThan(lines.clientHeight)
    expect(lines.scrollWidth, 'long lines scroll rather than wrap').toBeGreaterThan(lines.clientWidth)
    const marked = lines.querySelector<HTMLElement>('[data-marked]') as HTMLElement
    const view = lines.getBoundingClientRect()
    const line = marked.getBoundingClientRect()
    expect(line.top, 'the error line is scrolled into view').toBeGreaterThanOrEqual(view.top - 1)
    expect(line.bottom).toBeLessThanOrEqual(view.bottom + 1)
    expect(panel.textContent, 'a window of the long file, around the error').toContain(
      'Lines 302 to 701 of 701',
    )
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/open-failed-${size.name}.png` })
  })

  test('the top bar: Back, Undo, Redo and Save are all on screen at full size', async () => {
    const { conditions } = await start(size)
    await openFromHome(PROJECT)
    const essentials = ['undo', 'redo', 'save'].map(byTestId)
    const back = button(byTestId('document-bar'), 'Back')
    expect(checkLayout(conditions, [back, ...essentials])).toEqual([])
    const heading = byTestId('document-bar').querySelector('h1') as HTMLElement
    expect(heading.getBoundingClientRect().width, 'the title keeps some room').toBeGreaterThan(40)
    await page.screenshot({ path: `.vitest/shots/document-bar-${size.name}.png` })
  })

  test('the Restore dialog, then the conflict dialog: inside the screen with their actions reachable', async () => {
    const { conditions, workspace } = await start(size, { autosave: true })
    await openFromHome(PROJECT)
    const recover = dialog()
    expectInside(recover, size)
    const restore = button(recover, 'Keep my changes')
    expect(checkLayout(conditions, [button(recover, 'Throw away'), restore])).toEqual([])
    expect(restore.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.primary)
    expect(document.activeElement, 'the question has the focus, not the heading behind it').toBe(restore)
    await page.screenshot({ path: `.vitest/shots/recover-${size.name}.png` })

    restore.click()
    await arrived()
    await workspace.store.write(PROJECT, printProject({ ...mossgate(), name: 'Changed elsewhere' }))
    byTestId('save').click()
    await expect
      .poll(() => document.querySelector('[role="dialog"]'), { timeout: OPEN_TIMEOUT_MS })
      .not.toBeNull()
    await arrived()
    const conflict = dialog()
    expectInside(conflict, size)
    const choices = ['Cancel', 'Use theirs', 'Use mine', 'Keep both'].map((name) => button(conflict, name))
    expect(checkLayout(conditions, choices)).toEqual([])
    expect(
      button(conflict, 'Keep both').getBoundingClientRect().height,
      'the primary action',
    ).toBeGreaterThanOrEqual(targets.primary)
    await page.screenshot({ path: `.vitest/shots/conflict-${size.name}.png` })
  })
})
