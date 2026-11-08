import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { entity, withEntities, withLayer } from '#src/testing/level-2d/project-edit.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// The Export view with the production CSS in a real browser (plan ED2D.7b step 7; 2D editor spec §12), at the eight
// window sizes, in Chromium, WebKit and Firefox: Download 48 px, the other actions and the target cards 44 px, all in
// view and never clipped (the files scroll in their own region, the actions stay at the foot), and the page never
// scrolling. The Mossgate sample is seeded with the Checks view's findings, so the error callout shows.

const PROJECT = 'mossgate.af2d.json'

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

function seeded() {
  const project = mossgate()
  const level = project.levels[0]?.id ?? ''
  return withEntities(
    withLayer(project, level, 'decor', (layer) =>
      layer.kind === 'tiles' ? { ...layer, cells: layer.cells.set(4, 7, packTile(99, false, false)) } : layer,
    ),
    level,
    [
      entity('slime-z', 'slime', 5000, 40),
      entity('door-z', 'door', 32, 32, { target: { target: 'gone-1' } }),
    ],
  )
}

async function start(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PROJECT, printProject(seeded()))
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
  const card = document.querySelector<HTMLElement>('[role="option"]')
  if (card === null) throw new Error('no project card')
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
  const exportTab = [
    ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
  ].find((tab) => tab.textContent?.trim() === 'Export')
  exportTab?.click()
  await expect.poll(() => document.querySelector('[data-testid="export-view"]')).not.toBeNull()
  await arrived()
  return { conditions }
}

const buttonNamed = (root: ParentNode, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

describe.each(SIZES)('Export view at $name ($width x $height)', (size) => {
  test('the actions and target cards are sized, in view and unclipped; the page never scrolls', async () => {
    const { conditions } = await start(size)
    const view = byTestId('export-view')
    expect(view.querySelector('.callout strong')?.textContent).toMatch(/^\d+ errors?$/)
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    const actions = ['Download', 'Share', 'Copy', 'Write to folder'].map((name) => buttonNamed(view, name))
    const cards = [...view.querySelectorAll<HTMLElement>('label')]
    expect(cards).toHaveLength(2)
    expect(checkLayout(conditions, [...tabs, ...actions])).toEqual([])
    expect(actions[0]?.getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    for (const element of [...actions, ...cards])
      expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/export-view-${size.name}.png` })
  })
})
