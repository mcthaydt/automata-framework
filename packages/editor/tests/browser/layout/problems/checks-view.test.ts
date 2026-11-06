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
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { entity, withEntities, withLayer } from '#src/testing/level-2d/project-edit.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// The Checks view with the production CSS in a real browser, at the eight
// window sizes, in Chromium, WebKit and Firefox: the rail and every row's buttons at least 44 px and never clipped, the
// page never scrolling (the list scrolls in its own region), and the target dialog's choices full-size. The Mossgate
// sample is seeded with a stray tile, a slime outside its level and a door pointing at an instance that is gone.

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
  const card = document.querySelector<HTMLElement>('[aria-label="Levels"] .open')
  if (card === null) throw new Error('no level card')
  card.click()
  await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
  const checks = [
    ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
  ].find((tab) => tab.textContent?.trim() === 'Checks')
  checks?.click()
  await expect.poll(() => document.querySelector('[data-testid="checks-view"]')).not.toBeNull()
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

describe.each(SIZES)('Checks view at $name ($width x $height)', (size) => {
  test('the rail and every row button are sized and unclipped; the page never scrolls', async () => {
    const { conditions } = await start(size)
    const view = byTestId('checks-view')
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    const firstRow = view.querySelector('li')
    if (firstRow === null) throw new Error('no finding rows')
    const buttons = [...firstRow.querySelectorAll<HTMLElement>('button')]
    expect(buttons.map((button) => button.textContent?.trim())).toContain('Locate')
    expect(checkLayout(conditions, [...tabs, ...buttons])).toEqual([])
    for (const button of view.querySelectorAll('li button'))
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/checks-view-${size.name}.png` })
  })

  test('the target dialog lists its choices as full-size buttons', async () => {
    const { conditions } = await start(size)
    buttonNamed(byTestId('checks-view'), 'Choose target').click()
    await arrived()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog === null) throw new Error('no target dialog')
    const choices = [...dialog.querySelectorAll<HTMLElement>('li button')]
    expect(choices.length).toBeGreaterThan(0)
    expect(checkLayout(conditions, [...choices, buttonNamed(dialog, 'Cancel')])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/checks-target-${size.name}.png` })
  })
})
