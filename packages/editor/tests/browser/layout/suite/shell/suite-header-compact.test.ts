import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { settleLayout } from '@automata/framework/testing'
import { createRawSnippet } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { defineSuiteEditor, type SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import type { GamePublish } from '#src/shared/kit/storage/publish-client.ts'
import { atEverySize, WINDOW_SIZES } from '#src/testing/kit/at-every-size.ts'
import { SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { type FixtureSession, fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import { editorList, noPageScroll, type OpenedSuite, openSuite } from '#src/testing/suite/suite-layout.ts'

// A phone turned on its side, with a field being typed in: the header (two rows on a phone) must leave the field on the
// screen, focus and the typed words must stay through the turn, and Play, Publish, Undo and Redo stay whole targets at
// the pointer's size (44 px, Publish 48, once any coarse pointer is present, even with a mouse beside it). The
// on-screen keyboard is a journey's (`rotation-keeps-the-field`): a layout test has no keyboard to raise.

const targets = editorTargets()

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/none/*.json', 'tuner'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
}

const publish: GamePublish = {
  publish: async () => ({ ok: false, problem: 'No.', detail: '' }),
  download: async () => {},
}

/** The fixture editor with a text box on its canvas, where Writer has its line. */
const withLine: SuiteEditor<FixtureSession> = defineSuiteEditor<FixtureSession>({
  ...fixtureEditor,
  regions: {
    ...fixtureEditor.regions,
    canvas: createRawSnippet(() => ({
      render: () =>
        '<div><input data-testid="line-box" type="text" aria-label="Line" style="min-height: 44px" /></div>',
    })),
  },
})

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

const phone = (name: string) => {
  const found = SIZES.find((size) => size.name === name)
  if (found === undefined) throw new Error(`no ${name} size`)
  return found
}
const byName = (selector: string, name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>(selector)].find(
    (each) => (each.getAttribute('aria-label') ?? each.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name}`)
  return found
}
const heightOf = (element: HTMLElement): number => element.getBoundingClientRect().height

/** The field lies whole in the window, below the header's last row, so no row of the header covers it. */
function wholeOnScreen(field: HTMLElement): boolean {
  const box = field.getBoundingClientRect()
  const header = document.querySelector<HTMLElement>('[data-region="topbar"]')?.getBoundingClientRect()
  return (
    box.left >= -0.5 &&
    box.right <= window.innerWidth + 0.5 &&
    box.top >= (header?.bottom ?? 0) - 0.5 &&
    box.bottom <= window.innerHeight + 0.5
  )
}

/** The header's targets at the pointer's size: Play, Publish, Undo, Redo. */
function targetsHold(): void {
  expect(heightOf(byName('button', 'Publish')), 'Publish is a primary').toBeGreaterThanOrEqual(
    targets.primary,
  )
  // Publish is the one primary (PATTERNS: "one primary button per screen"); Play is a plain hit-size button beside it.
  for (const name of ['Undo', 'Redo', 'Play'])
    expect(
      heightOf(byName(name === 'Play' ? 'a' : 'button', name)),
      `${name} is a target`,
    ).toBeGreaterThanOrEqual(targets.hit)
}

async function open() {
  opened = await openSuite(
    phone('phone-portrait'),
    [withLine as SuiteEditor<unknown>],
    FILES,
    '[data-testid="line-box"]',
    'Tuner',
    {
      playUrl: 'http://localhost:5199/',
      publish,
    },
  )
  const line = document.querySelector<HTMLInputElement>('[data-testid="line-box"]') as HTMLInputElement
  line.focus()
  await userEvent.keyboard('Mind the step')
  return line
}

describe('A phone header with a field being typed in', () => {
  test('keeps focus, the words and the targets through a turn and back, and never covers the field', async () => {
    const line = await open()
    const phoneSizes = WINDOW_SIZES.filter((size) => size.name.startsWith('phone'))
    // Landscape (844 x 390, the compact height), then upright, then the small phone: each size from the one before it.
    const turns = ['phone-landscape-844x390', 'phone-portrait-390x844', 'phone-small-360x640']
    await atEverySize(
      (width, height) => page.viewport(width, height),
      async (size) => {
        await settleLayout()
        expect(document.activeElement, `focus is kept at ${size.name}`).toBe(line)
        expect(line.value, `the words are kept at ${size.name}`).toBe('Mind the step')
        expect(wholeOnScreen(line), `the header does not cover the field at ${size.name}`).toBe(true)
        targetsHold()
        noPageScroll()
      },
      turns.flatMap((name) => phoneSizes.filter((size) => size.name === name)),
    )
  })

  test('keeps touch sizes when a mouse moves over the header: the pointer kinds present decide, not the last one used', async () => {
    await open()
    const before = [byName('button', 'Publish'), byName('button', 'Undo')].map(heightOf)
    await userEvent.hover(byName('button', 'Undo'))
    await userEvent.hover(byName('a', 'Play'))
    await settleLayout()
    expect([byName('button', 'Publish'), byName('button', 'Undo')].map(heightOf)).toEqual(before)
    const coarse = matchMedia('(any-pointer: coarse)').matches
    // With any coarse pointer present the touch rule holds, a mouse over the header or not.
    expect(targets.hit).toBe(coarse ? 44 : 28)
    expect(targets.primary).toBe(coarse ? 48 : 32)
    targetsHold()
  })
})
