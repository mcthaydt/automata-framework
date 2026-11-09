import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { createRawSnippet } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { SAMPLE_GAME, samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'

// The rail with nine editors (the game's editors, every one the page registers): on a phone held upright the bar keeps
// every tab at 44 px and folds what does not fit under More; on an iPad the column is as wide as its longest name, so no
// name is cut.

const targets = editorTargets()
const NAMES = [
  'Tuner',
  'Levels',
  'Characters',
  'Feel',
  'Audio',
  'Writer',
  'Sequence',
  'Schematic',
  'Playtest',
]

const editor = (label: string): SuiteEditor<unknown> =>
  ({
    id: label.toLowerCase(),
    label,
    icon: 'list',
    hue: 'color/ed/tuner',
    open: async () => ({ label }),
    regions: {
      canvas: createRawSnippet(() => ({ render: () => `<p data-testid="open-editor">${label}</p>` })),
    },
  }) as unknown as SuiteEditor<unknown>

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(width: number, height: number, labels: readonly string[] = NAMES) {
  await page.viewport(width, height)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(SAMPLE_GAME),
    suite: createSuite({ editors: labels.map(editor) }),
    sample: false,
    game: 'Moss Gate',
  })
  await settleLayout()
}

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
const more = (): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.getAttribute('aria-label') === 'More',
  )
const names = (): (string | undefined)[] => tabs().map((tab) => tab.textContent?.trim())

describe('the rail with nine editors on a phone held upright (390 x 844)', () => {
  test('keeps every tab at 44 px inside the bar and folds the rest under More', async () => {
    await open(390, 844)
    const bar = document.querySelector<HTMLElement>('[role="tablist"]')?.parentElement
    if (bar == null) throw new Error('no rail')
    const room = bar.getBoundingClientRect()
    expect(tabs().length).toBeGreaterThan(0)
    expect(tabs().length).toBeLessThan(NAMES.length)
    for (const tab of tabs()) {
      const box = tab.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.left).toBeGreaterThanOrEqual(room.left - 0.5)
      expect(box.right).toBeLessThanOrEqual(room.right + 0.5)
    }
    const button = more()
    if (button === undefined) throw new Error('no More tab')
    const box = button.getBoundingClientRect()
    expect(box.height).toBeGreaterThanOrEqual(targets.hit)
    expect(box.right).toBeLessThanOrEqual(room.right + 0.5)
    for (const label of document.querySelectorAll<HTMLElement>('[role="tablist"] .label'))
      expect(label.scrollWidth).toBeLessThanOrEqual(Math.ceil(label.getBoundingClientRect().width))
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  test('More names the rest, and choosing Schematic opens it and shows its tab', async () => {
    await open(390, 844)
    const shown = names()
    const button = more()
    if (button === undefined) throw new Error('no More tab')
    button.click()
    await arrived()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.map((item) => item.textContent?.trim())).toEqual(
      NAMES.filter((name) => !shown.includes(name)),
    )
    for (const item of items) expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    items.find((item) => item.textContent?.trim() === 'Schematic')?.click()
    await expect
      .poll(() => document.querySelector('[data-testid="open-editor"]')?.textContent)
      .toBe('Schematic')
    await arrived()
    expect(names()).toContain('Schematic')
    expect(
      tabs()
        .find((tab) => tab.textContent?.trim() === 'Schematic')
        ?.getAttribute('aria-selected'),
    ).toBe('true')
  })

  test('keeps the open editor among the shown tabs when it was last on the rail', async () => {
    await open(390, 844)
    await page.getByRole('button', { name: 'More' }).click()
    await arrived()
    ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.trim() === 'Playtest')
      ?.click()
    await expect
      .poll(() => document.querySelector('[data-testid="open-editor"]')?.textContent)
      .toBe('Playtest')
    await arrived()
    expect(names()).toContain('Playtest')
    // The menu now holds the editor that gave up its tab.
    expect(more()).toBeDefined()
  })
})

describe('the rail with nine editors on an iPad (1180 x 820)', () => {
  test('is wide enough for the longest name, so no name is cut', async () => {
    await open(1180, 820)
    expect(names()).toEqual(NAMES)
    const column = document.querySelector<HTMLElement>('[data-region="rail"]')?.getBoundingClientRect()
    if (column === undefined) throw new Error('no rail')
    expect(column.width).toBeGreaterThanOrEqual(68)
    for (const label of document.querySelectorAll<HTMLElement>('[role="tablist"] .label')) {
      const box = label.getBoundingClientRect()
      // The text is whole: its box holds it (a fractional width rounds), and the box is inside the column.
      expect(label.scrollWidth, label.textContent ?? '').toBeLessThanOrEqual(Math.ceil(box.width))
      expect(box.left).toBeGreaterThanOrEqual(column.left)
      expect(box.right).toBeLessThanOrEqual(column.right)
    }
    for (const tab of tabs()) expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    expect(more()).toBeUndefined()
  })
})

describe('the rail on the try-it page, where both kinds of level and character editor show (1180 x 820)', () => {
  const BOTH = ['Tuner', 'Levels 2D', 'Characters 2D', 'Levels 3D', 'Characters 3D', 'Feel']

  test('tells Characters 2D from Characters 3D: each name is whole, not cut to "Characters …"', async () => {
    await open(1180, 820, BOTH)
    expect(names()).toEqual(BOTH)
    for (const label of document.querySelectorAll<HTMLElement>('[role="tablist"] .label')) {
      const box = label.getBoundingClientRect()
      expect(label.scrollWidth, label.textContent ?? '').toBeLessThanOrEqual(Math.ceil(box.width))
    }
    for (const tab of tabs()) expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
  })
})
