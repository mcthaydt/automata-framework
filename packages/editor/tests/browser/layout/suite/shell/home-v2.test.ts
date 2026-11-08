import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { afterEach, describe, expect, test } from 'vitest'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import type { GamePublish } from '#src/shared/kit/storage/publish-client.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import { screenChecks } from '#src/testing/screen-checks.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'
import { editorList, type OpenedSuite, openSuiteHome } from '#src/testing/suite/suite-layout.ts'

// Home in the v2 look at every size, in Dark and in Light: the cards run three to a row in the wide layout, two in the
// medium and one on a phone, the page never scrolls sideways, every control is a target, Publish is the one lime button
// and the words can be read (axe's contrast at the two sizes the spec names).

const touch = matchMedia('(any-pointer: coarse)').matches

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af2d.json', 'levels-2d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/start.af2d.json': platformer,
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
  delete document.documentElement.dataset['theme']
})

const COLUMNS = { wide: 3, medium: 2, compact: 1 } as const

describe.each(['dark', 'light'] as const)('Home in %s', (look) => {
  describe.each(SIZES)('at $name ($width x $height)', (size) => {
    test('lays its cards in the columns of its layout and passes the screen checks', async () => {
      document.documentElement.dataset['theme'] = look
      opened = await openSuiteHome(size, editors(), FILES, { publish })
      const cards = document.querySelector<HTMLElement>('[data-testid="suite-home"] .cards')
      expect(cards).not.toBeNull()
      const columns = getComputedStyle(cards as HTMLElement).gridTemplateColumns.split(' ').length
      expect(columns, 'cards per row').toBe(COLUMNS[size.mode])
      const contrast =
        (size.width === 1194 && size.height === 834) || (size.width === 390 && size.height === 844)
      expect(
        await screenChecks(
          document,
          { name: size.name, width: size.width, height: size.height, touch },
          {
            contrast,
            lime: 1,
          },
        ),
      ).toEqual([])
    })
  })
})
