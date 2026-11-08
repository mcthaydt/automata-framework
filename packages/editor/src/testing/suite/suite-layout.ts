// What the suite's real-browser layout tests share (the level editors' own tests are in the packages that own them): open
// the suite at a size with the production CSS, find a tab or a region inside the one shell, and check the page never
// scrolls. The caller says which editors the suite holds, so a package tests only the editors it has.
import { publishConditions, settleLayout } from '@automata/framework/testing'
import { expect } from 'vitest'
import { page } from 'vitest/browser'
import { samplePorts } from '../../features/suite/memory/sample-ports'
import { type SuiteEnv, type SuiteHandle, startSuite } from '../../features/suite/shell/boot'
import { createSuite } from '../../features/suite/shell/create-suite'
import type { SuiteEditor } from '../../shared/kit/ports/suite-editor.ts'
import { arrived, type EditorSize, REST } from '../kit/layout-sizes.ts'
import { editorTargets } from '../kit/targets'

/** One `[[file]]` row of an editor list. */
const row = (glob: string, editor: string): string =>
  `[[file]]\nglob = "${glob}"\neditor = "${editor}"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

/** An editor list that sends `content/tuning.toml` to the Tuner and `glob` to `editor`. */
export const editorList = (glob: string, editor: string): string =>
  `format = "af-editors/1"\n${row('content/tuning.toml', 'tuner')}\n${row(glob, editor)}`

/** A suite opened by {@link openSuite}; `close` puts the page back as it was. */
export interface OpenedSuite {
  readonly conditions: ReturnType<typeof publishConditions>
  close(): Promise<void>
}

/** Open the suite with `editors` over `files` at `size`, choose the rail's `entry` tab and wait for `ready` to appear. */
export async function openSuite(
  size: EditorSize,
  editors: SuiteEditor<unknown>[],
  files: Record<string, string>,
  ready: string,
  entry: string,
  /** What a served game adds to the top bar: the page Play opens, why it is off, and Publish. */
  game: Pick<SuiteEnv, 'playUrl' | 'playOff' | 'publish'> = {},
): Promise<OpenedSuite> {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, editorTargets())
  const target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  const started: SuiteHandle = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors }),
    ...game,
  })
  await settleLayout()
  await chooseEditor(entry)
  await expect.poll(() => document.querySelector(ready)).not.toBeNull()
  await settleLayout()
  return {
    conditions,
    close: async () => {
      await started.dispose()
      target.remove()
    },
  }
}

export function tab(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} tab`)
  return found
}

/** The More button of the compact tab bar, where the editors beyond its four tabs wait; `undefined` when every editor has a tab. */
export function moreButton(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === 'More' && button.getAttribute('aria-haspopup') === 'dialog',
  )
}

/** The control that reaches editor `name`: its tab, or More where the tab bar has no room for its tab. */
export function editorControl(name: string): HTMLElement {
  const tabbed = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  const more = moreButton()
  if (tabbed === undefined && more !== undefined) return more
  return tab(name)
}

/** Choose editor `name` the way a person does: tap its tab, or open More and pick it; the first when unnamed. */
export async function chooseEditor(name?: string): Promise<void> {
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
  const tabbed =
    name === undefined ? tabs[0] : tabs.find((candidate) => candidate.textContent?.trim() === name)
  if (tabbed !== undefined) {
    tabbed.click()
    return
  }
  const more = moreButton()
  if (more === undefined) throw new Error(`no ${name ?? 'editor'} tab`)
  more.click()
  await arrived()
  const item = [...document.querySelectorAll<HTMLElement>('[data-more-entry]')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (item === undefined) throw new Error(`no ${name} under More`)
  item.click()
}

export function inShell(selector: string): HTMLElement {
  const shells = document.querySelectorAll('[data-editor-shell]')
  expect(shells).toHaveLength(1)
  const found = shells[0]?.querySelector<HTMLElement>(selector)
  if (found === null || found === undefined) throw new Error(`no ${selector} in the shell`)
  return found
}

/** The canvas has real room (the Level view's own bar: a medium dock starts open as a strip over its foot). */
export function inView(element: HTMLElement, size: EditorSize): void {
  const box = element.getBoundingClientRect()
  // Wide is a 224 px sidebar, a 264 px list and a 320 px inspector: 1194 px leaves about 370 for the stage.
  expect(box.width).toBeGreaterThan(size.mode === 'wide' ? 320 : size.width / 3)
  expect(box.height).toBeGreaterThan(size.mode === 'compact' && size.height < 500 ? 80 : 200)
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
}

/** The suite's top-bar toggle for the dock, where the dock is a sheet. */
export const dockToggle = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('button')].filter(
    (button) => button.textContent?.trim() === 'Dock',
  )

export function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
}
