import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
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
import { editorList, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// Levels 2D in the v2 look: Level, Tiles and Characters at every size in Dark and Light. Each passes the screen checks
// (no sideways scroll, every control a target, Publish the one lime button, readable words), and the stage is the dark
// dotted floor in both looks so the game's colours never shift.

const touch = matchMedia('(any-pointer: coarse)').matches

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
  delete document.documentElement.dataset['theme']
})

/** Chooses a view as a person does: its tab in the header, or on a phone the title's sheet. */
async function chooseView(name: 'Tiles' | 'Characters'): Promise<void> {
  const direct = [...document.querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (radio) => radio.textContent?.trim() === name && radio.getBoundingClientRect().width > 0,
  )
  if (direct !== undefined) {
    direct.click()
    await settleLayout()
    return
  }
  const title = document.querySelector<HTMLElement>('[data-region="topbar"] [aria-haspopup="dialog"]')
  if (title === null) throw new Error(`no way to reach ${name}`)
  title.click()
  await settleLayout()
  const radio = [...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="radio"]')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (radio === undefined) throw new Error(`no ${name} in the title's sheet`)
  radio.click()
  await settleLayout()
  document
    .querySelector<HTMLElement>('[role="dialog"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settleLayout()
}

const VIEWS = [undefined, 'Tiles', 'Characters'] as const
const SHOWN = { Tiles: 'tilesets-view', Characters: 'entities-view' } as const

describe.each(['dark', 'light'] as const)('Levels 2D in %s', (look) => {
  describe.each(SIZES)('at $name ($width x $height)', (size) => {
    test.each(VIEWS)('the %s view passes the screen checks', async (view) => {
      document.documentElement.dataset['theme'] = look
      opened = await openSuite(size, editors(), FILES, '[data-testid="level-canvas"]', 'Levels', { publish })
      if (view !== undefined) {
        await chooseView(view)
        expect(
          document.querySelector(`[data-testid="${SHOWN[view]}"]`),
          `the ${view} view is up`,
        ).not.toBeNull()
      }
      const contrast =
        (size.width === 1194 && size.height === 834) || (size.width === 390 && size.height === 844)
      expect(
        await screenChecks(
          document,
          { name: size.name, width: size.width, height: size.height, touch },
          { contrast, lime: 1 },
        ),
      ).toEqual([])
    })
  })
})

const sized = (name: string) => {
  const found = SIZES.find((size) => size.name === name)
  if (found === undefined) throw new Error(`no size ${name}`)
  return found
}

describe('the Level view’s tools and stage', () => {
  test('on a phone the tool dock sits just above the tab bar', async () => {
    opened = await openSuite(
      sized('phone-portrait'),
      editors(),
      FILES,
      '[data-testid="level-canvas"]',
      'Levels',
    )
    const dock = document.querySelector<HTMLElement>('[data-testid="level-toolbar"]')
    const bar = document.querySelector<HTMLElement>('[role="tablist"]')
    expect(dock).toHaveAttribute('data-at', 'dock')
    expect((dock as HTMLElement).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      (bar as HTMLElement).getBoundingClientRect().top + 0.5,
    )
  })

  test('turned sideways the dock stands at the stage’s right edge', async () => {
    opened = await openSuite(
      sized('phone-landscape'),
      editors(),
      FILES,
      '[data-testid="level-canvas"]',
      'Levels',
    )
    const dock = (
      document.querySelector('[data-testid="level-toolbar"]') as HTMLElement
    ).getBoundingClientRect()
    const stage = (document.querySelector('[data-region="canvas"]') as HTMLElement).getBoundingClientRect()
    expect(stage.right - dock.right).toBeLessThanOrEqual(16)
    expect(dock.height).toBeGreaterThan(dock.width)
  })

  test.each(['dark', 'light'] as const)('the stage is the same dark dotted floor in %s', async (look) => {
    document.documentElement.dataset['theme'] = look
    opened = await openSuite(
      sized('ipad-pro-11-landscape'),
      editors(),
      FILES,
      '[data-testid="level-canvas"]',
      'Levels',
    )
    const stage = getComputedStyle(document.querySelector('[data-region="canvas"]') as HTMLElement)
    const probe = document.body.appendChild(document.createElement('i'))
    probe.style.backgroundColor = 'var(--tool-stage)'
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    expect(stage.backgroundColor).toBe(expected)
    expect(stage.backgroundImage).toContain('radial-gradient')
  })
})
