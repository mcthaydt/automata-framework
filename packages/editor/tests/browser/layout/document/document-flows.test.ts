import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/level-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createAppProfiles } from '#src/app/level-2d/profiles.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { type OpenLevelScreen, openLevelScreen } from '#src/testing/level-2d/open-level-screen.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The open document's dialogs with the production CSS in a real browser: the top bar, then the Restore and conflict
// dialogs, at the eight window sizes. jsdom has no layout, so room (inside the screen, target sizes, what covers what)
// is only checked here. The level's own screen opens over a memory workspace, as the suite's Levels pane shows it.

const PROJECT = 'mossgate.af2d.json'

let started: OpenLevelScreen | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

/** Opens the sample at `size` and, if asked, with an autosave on offer from an earlier visit. */
async function start(size: EditorSize, options: { autosave?: boolean } = {}) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PROJECT, printProject(mossgate()))
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
  started = await openLevelScreen(target, workspace, PROJECT)
  await settleLayout()
  await expect
    .poll(() => document.querySelector('[role="dialog"], [data-testid="document-bar"]'), { timeout: 10_000 })
    .not.toBeNull()
  await arrived()
  return { conditions, workspace }
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

describe.each(SIZES)('open document at $name ($width x $height)', (size) => {
  test('the top bar: Back, Undo, Redo and Save are all on screen at full size', async () => {
    const { conditions } = await start(size)
    const essentials = ['undo', 'redo', 'save'].map(byTestId)
    const back = button(byTestId('document-bar'), 'Back')
    expect(checkLayout(conditions, [back, ...essentials])).toEqual([])
    const heading = byTestId('document-bar').querySelector('h1') as HTMLElement
    expect(heading.getBoundingClientRect().width, 'the title keeps some room').toBeGreaterThan(40)
    await page.screenshot({ path: `.vitest/shots/document-bar-${size.name}.png` })
  })

  test('the Restore dialog, then the conflict dialog: inside the screen with their actions reachable', async () => {
    const { conditions, workspace } = await start(size, { autosave: true })
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
    await expect.poll(() => document.querySelector('[role="dialog"]'), { timeout: 10_000 }).not.toBeNull()
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
