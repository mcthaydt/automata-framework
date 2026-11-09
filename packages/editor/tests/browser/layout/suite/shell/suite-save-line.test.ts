import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import type { SuiteSync } from '#src/features/suite/shell/boot.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import {
  createStatusStore,
  STATUS_LINES,
  type SyncState,
  statusOf,
  stoppedStatus,
} from '#src/shared/kit/sync/sync-status.ts'
import { type EditorSize, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import { editorList, noPageScroll, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// The saved line says where the work is, and on a phone it used to be cut to "Saved on this de…" so the part that
// matters ("Not on GitHub yet") was never seen, and at 360 px it pushed Redo off the screen. Every line the sync can say
// must be whole on every phone, with the game's name and Undo and Redo still on screen.

const FILES = {
  'content/editors.toml': editorList('content/tuning.toml', 'tuner'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
}

const PHONES: readonly EditorSize[] = [
  ...SIZES.filter((size) => size.name === 'phone-portrait' || size.name === 'phone-landscape'),
  {
    ...(SIZES.find((size) => size.name === 'phone-portrait') as EditorSize),
    name: 'small-phone',
    width: 360,
    height: 740,
  },
  { ...(SIZES.find((size) => size.name === 'ipad-pro-11-portrait') as EditorSize) },
]

const STATES = Object.keys(STATUS_LINES) as SyncState[]
const status = (state: SyncState) =>
  state === 'stopped' ? stoppedStatus('GitHub asked us to wait a minute.') : statusOf(state)

function kept(state: SyncState): SuiteSync {
  return {
    status: createStatusStore(status(state)),
    onPulled: () => () => undefined,
    holdWhile: () => () => undefined,
    retry: () => undefined,
    conflicts: async () => [],
    resolve: async () => true,
  }
}

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

const whole = (element: HTMLElement | null, name: string): void => {
  if (element === null) throw new Error(`no ${name}`)
  const box = element.getBoundingClientRect()
  expect(box.width, `${name} has a width`).toBeGreaterThan(0)
  expect(box.left, `${name} is on the left of the screen`).toBeGreaterThanOrEqual(-0.5)
  expect(box.right, `${name} is on the right of the screen`).toBeLessThanOrEqual(window.innerWidth + 0.5)
  expect(box.bottom, `${name} is above the foot of the screen`).toBeLessThanOrEqual(window.innerHeight + 0.5)
}

describe.each(PHONES)('the saved line at $name ($width x $height)', (size) => {
  test.each(STATES)('says all of "%s", with the game name and Undo and Redo in view', async (state) => {
    opened = await openSuite(size, [fixtureEditor as SuiteEditor<unknown>], FILES, '[data-testid]', 'Tuner', {
      sync: kept(state),
      game: 'Lantern Run',
      gameKey: 'lantern-run',
      where: 'device',
    })
    await settleLayout()
    const words = document.querySelector<HTMLElement>('[role="status"] .words, button.where .words')
    if (words === null) throw new Error('no saved line')
    expect(words.textContent?.trim(), 'the line is the one the sync gave').toBe(status(state).line)
    expect(words.scrollWidth, `"${words.textContent}" is not cut`).toBeLessThanOrEqual(words.clientWidth + 1)
    whole(words, 'the saved line')
    const brand = document.querySelector<HTMLElement>('.brand')
    expect(brand?.scrollWidth, 'the game name is not cut').toBeLessThanOrEqual((brand?.clientWidth ?? 0) + 1)
    for (const label of ['Undo', 'Redo']) {
      const control = [...document.querySelectorAll<HTMLElement>('button')].find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(label),
      )
      whole(control ?? null, label)
    }
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/save-line-${size.name}-${state}.png` })
  })
})
