// What the suite's real-browser layout tests share (the level editors' own tests are in the packages that own them): open
// the suite at a size with the production CSS, find a tab or a region inside the one shell, and check the page never
// scrolls. The caller says which editors the suite holds, so a package tests only the editors it has.
import { publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { expect } from 'vitest'
import { page } from 'vitest/browser'
import { type SuiteHandle, startSuite } from '../../features/suite/shell/boot'
import { createSuite } from '../../features/suite/shell/create-suite'
import type { SuiteEditor } from '../../shared/kit/ports/suite-editor.ts'
import { type EditorSize, REST } from '../kit/layout-sizes.ts'
import { samplePorts } from './sample-ports'

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

/** Open the suite with `editors` over `files` at `size`, switch to the Levels tab and wait for `ready` to appear. */
export async function openSuite(
  size: EditorSize,
  editors: SuiteEditor<unknown>[],
  files: Record<string, string>,
  ready: string,
): Promise<OpenedSuite> {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  const target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  const started: SuiteHandle = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors }),
  })
  await settleLayout()
  tab('Levels').click()
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
  expect(box.width).toBeGreaterThan(size.mode === 'wide' && size.width < 1000 ? 240 : size.width / 3)
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
