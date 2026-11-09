import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import {
  type MountedFixture,
  mountFixture,
  publishConditions,
  settleLayout,
  VARIANTS,
} from '@automataframework/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import ShellFixture from '#src/testing/kit/ShellFixture.svelte'

// The shell keeps the page from reacting to a touch the way a web page does (the Owner, on a real iPad: a double tap
// zooms, and a hold selects the screen like text). `touch-action: manipulation` on the page ends double-tap zoom while
// the canvas keeps `none` for its own gestures; user-select and the callout are off on the chrome and stay on where a
// person types or reads code. Computed styles are the only honest check: jsdom computes neither.

const REST = VARIANTS.find((variant) => variant.name === 'rest') as (typeof VARIANTS)[number]

let mounted: MountedFixture | undefined
const extras: HTMLElement[] = []
afterEach(async () => {
  await mounted?.unmount()
  for (const extra of extras.splice(0)) extra.remove()
  mounted = undefined
})

const style = (element: Element) => getComputedStyle(element)
/** `-webkit-user-select` is the only spelling Safari answers to; the others answer to `user-select`. */
const selects = (element: Element): string => {
  const computed = style(element)
  return computed.userSelect || computed.getPropertyValue('-webkit-user-select')
}

async function mountOnIpad(): Promise<void> {
  await page.viewport(1194, 834)
  const conditions = publishConditions(
    document.documentElement,
    { name: 'ipad', width: 1194, height: 834, formFactor: 'desktop', group: 'tablet' } as never,
    REST,
  )
  mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry } })
  await settleLayout()
}

describe('touch guard', () => {
  test('the page ends double-tap zoom, the canvas keeps its own gestures, and the chrome is not selectable', async () => {
    await mountOnIpad()
    expect(style(document.documentElement).touchAction).toBe('manipulation')
    expect(style(document.body).touchAction).toBe('manipulation')
    const canvas = document.querySelector('[data-region="canvas"]') as HTMLElement
    expect(style(canvas).touchAction).toBe('none')
    const button = document.querySelector(
      '[data-region="rail"] button, [data-region="topbar"] button',
    ) as HTMLElement
    expect(selects(button), 'a button is not selectable').toBe('none')
    expect(
      selects(document.querySelector('[data-region="status"]') as Element),
      'chrome text is not selectable',
    ).toBe('none')
  })

  test('an input, a textarea and a contenteditable still select', async () => {
    await mountOnIpad()
    const shell = document.querySelector('[data-editor-shell]') as HTMLElement
    const input = shell.appendChild(document.createElement('input'))
    const area = shell.appendChild(document.createElement('textarea'))
    const editable = shell.appendChild(document.createElement('div'))
    editable.setAttribute('contenteditable', 'true')
    extras.push(input, area, editable)
    for (const element of [input, area, editable]) expect(selects(element)).toBe('text')
  })
})
