import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import { editorList, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// The open editor's own tools (the Level, Tiles and Characters views, the level picker, Undo, Publish) sit in the top
// bar's sideways scroller. A tool takes the press aimed at it, so none lies over another: the views' box is as wide as
// the tabs inside it (a box capped narrower than its tabs left the next tool, the level picker, over Characters, and it
// took the press, on a phone held upright, where the saved line has a row of its own and the scroller is narrow).

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}

const READY = '[data-testid="level-canvas"]'

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

/**
 * What a finger lands on where it should land on `control`: the control or something inside it, else what covers it.
 * A finger is wider than a point, and a bar that is narrower or wider changes how much of a tool another one covers, so
 * the press is tried at the control's middle and a little in from each side.
 */
function pressLandsOn(control: HTMLElement): string | undefined {
  const box = control.getBoundingClientRect()
  for (const along of [0.15, 0.5, 0.85]) {
    const hit = document.elementFromPoint(box.left + box.width * along, box.top + box.height / 2)
    if (hit !== null && (hit === control || control.contains(hit))) continue
    const covering = hit?.closest('button, a, [role]') ?? hit
    return covering === null || covering === undefined
      ? 'nothing'
      : `${covering.tagName.toLowerCase()} "${covering.getAttribute('aria-label') ?? covering.textContent?.trim() ?? ''}"`
  }
  return undefined
}

describe.each(SIZES)('the top bar’s tools at $name ($width x $height)', (size) => {
  test('every tool takes the press aimed at its centre, and no tool lies over another', async () => {
    opened = await openSuite(
      size,
      [createLevels2d({ ids: { next: () => 'thing' }, canvas: StandInLevelCanvas }) as SuiteEditor<unknown>],
      FILES,
      READY,
      'Levels',
      { game: 'Lantern Run' },
    )
    const tools = document.querySelector<HTMLElement>('[data-region="topbar"] .tools')
    if (tools === null) throw new Error('no tools in the top bar')
    const views = tools.querySelector<HTMLElement>('[aria-label="Views"]')
    const radios = [...(views?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
    expect(radios.map((radio) => radio.textContent?.trim())).toContain('Characters')
    const picker = [...tools.querySelectorAll<HTMLElement>('button')].find((button) =>
      button.getAttribute('aria-label')?.startsWith('Level: '),
    )
    if (views === null || picker === undefined) throw new Error('no views or level picker')

    // The views' box holds its tabs, so the next tool starts after them.
    const last = radios[radios.length - 1]?.getBoundingClientRect()
    expect(views.getBoundingClientRect().right, 'the views’ box reaches its last tab').toBeGreaterThanOrEqual(
      (last?.right ?? 0) - 1,
    )
    expect(
      picker.getBoundingClientRect().left,
      'the level picker is after the last tab',
    ).toBeGreaterThanOrEqual((last?.right ?? 0) - 1)

    // Each tool is scrolled to the way a finger, or a test runner, brings it into the scroller, then pressed.
    for (const control of [...radios, picker]) {
      control.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      await settleLayout()
      expect(
        pressLandsOn(control),
        `a press on ${control.getAttribute('aria-label') ?? control.textContent?.trim()} lands on it, not on what covers it`,
      ).toBeUndefined()
    }
  })
})
