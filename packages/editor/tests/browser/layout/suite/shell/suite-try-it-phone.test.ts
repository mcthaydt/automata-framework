import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { SAMPLE_GAME, samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import { editorList, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// The try-it's first minute on a phone held upright (390 x 844): the title says "Sample game" whole, the note shows the
// command that makes a game of your own, and Levels fits its tools inside the screen, brush size included.

const PHONE = SIZES.find((size) => size.width === 390 && size.height === 844)
if (PHONE === undefined) throw new Error('the reference sizes have no 390 x 844 phone')
const WIDTH = PHONE.width
let started: SuiteHandle | undefined
let target: HTMLElement | undefined
let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open() {
  await page.viewport(PHONE.width, PHONE.height)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(SAMPLE_GAME),
    suite: createSuite({ editors: [createLevels2d({ ids: counterIds() })] as SuiteEditor<unknown>[] }),
    sample: true,
    game: undefined,
  })
  await settleLayout()
}

const inside = (node: Element): boolean => {
  const box = node.getBoundingClientRect()
  return box.left >= 0 && box.right <= WIDTH
}

describe('the try-it on a phone', () => {
  test('the title is whole, not cut to "Sa…"', async () => {
    await open()
    const bar = document.querySelector<HTMLElement>('[data-region="topbar"]')
    const title = [...(bar?.querySelectorAll<HTMLElement>('*') ?? [])].find(
      (node) => node.textContent?.trim() === 'Sample game',
    )
    if (title === undefined) throw new Error('the top bar does not say Sample game')
    expect(inside(title)).toBe(true)
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1)
  })

  test('the note and its command stay inside the screen', async () => {
    await open()
    const note = document.querySelector<HTMLElement>('[role="note"]')
    if (note === null) throw new Error('no note')
    expect(inside(note)).toBe(true)
    const command = [...note.querySelectorAll('code')].find((node) =>
      /create-game/.test(node.textContent ?? ''),
    )
    if (command === undefined) throw new Error('the note does not show the command')
    expect(inside(command)).toBe(true)
  })

  test('in Levels the tools, brush size included, fit the screen', async () => {
    opened = await openSuite(
      PHONE,
      [createLevels2d({ ids: counterIds(), canvas: StandInLevelCanvas }) as SuiteEditor<unknown>],
      {
        [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
        'content/levels/world.af2d.json': platformer,
      },
      '[data-testid="level-canvas"]',
      'Levels',
    )
    const brush = [...document.querySelectorAll<HTMLElement>('button, output')].find((node) =>
      /^Brush size/.test(node.getAttribute('aria-label') ?? ''),
    )
    if (brush === undefined) throw new Error('no brush size control')
    expect(inside(brush)).toBe(true)
    const toolbar = document.querySelector<HTMLElement>('[data-testid="level-toolbar"]')
    if (toolbar === null) throw new Error('no toolbar')
    expect(inside(toolbar)).toBe(true)
    expect(document.documentElement.scrollLeft).toBe(0)
  })
})
