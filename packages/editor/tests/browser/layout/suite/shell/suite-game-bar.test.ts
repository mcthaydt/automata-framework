import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import type { GamePublish } from '#src/shared/kit/storage/publish-client.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import { editorList, noPageScroll, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// Play and Publish on a game's own folder, with the production CSS in real browsers at every size: they are never cut
// off. A person with a phone must be able to press both, and the bar scrolls sideways when it is short of room, so
// "present in the page" proves nothing: each must lie whole inside what the top bar shows, and so must everything in
// the Game menu a phone opens.

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

describe.each(SIZES)('Play and Publish at $name ($width x $height)', (size) => {
  test('are whole in the top bar: two buttons where there is room, one Game menu on a phone', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="level-canvas"]', 'Levels', {
      playUrl: 'http://localhost:5199/',
      publish,
    })
    await settleLayout()
    if (size.mode === 'compact') {
      wholeInView(byName('button', 'Game'), 'Game')
      byName('button', 'Game').click()
      await expect.poll(() => document.querySelector('[role="menu"]')).not.toBeNull()
      await settleLayout()
      for (const label of ['Play your game', 'Make it ready to upload']) {
        const item = byName('[role="menuitem"]', label)
        const box = item.getBoundingClientRect()
        expect(box.left, label).toBeGreaterThanOrEqual(-0.5)
        expect(box.right, label).toBeLessThanOrEqual(window.innerWidth + 0.5)
        expect(box.bottom, label).toBeLessThanOrEqual(window.innerHeight + 0.5)
        expect(box.height, label).toBeGreaterThanOrEqual(targets.hit)
      }
    } else {
      wholeInView(byName('a', 'Play'), 'Play')
      wholeInView(byName('button', 'Publish'), 'Publish')
    }
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/suite-game-bar-${size.name}.png` })
  })

  test('keep Play on the bar, off, when the game could not start', async () => {
    opened = await openSuite(size, editors(), FILES, '[data-testid="level-canvas"]', 'Levels', {
      playOff:
        'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.',
      publish,
    })
    await settleLayout()
    if (size.mode === 'compact') {
      wholeInView(byName('button', 'Game'), 'Game')
    } else {
      const play = byName('button', 'Play')
      expect(play.getAttribute('aria-disabled')).toBe('true')
      wholeInView(play, 'Play')
      wholeInView(byName('button', 'Publish'), 'Publish')
    }
    noPageScroll()
  })
})
