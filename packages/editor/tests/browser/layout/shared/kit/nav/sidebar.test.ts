import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import NavFixture from '#src/testing/kit/NavFixture.svelte'
import { editorTargets } from '#src/testing/kit/targets.ts'

// The sidebar and its folded rail with production CSS: no editor's name is cut in either, rows are the hit size (32 px
// with a mouse, 44 with touch) and a rail item is 52 px (56 with touch), as the approved mockup draws them.
const NAMES = ['Tuner', 'Studio', 'Audio', 'Feel', 'Writer', 'Schematic', 'Sequence', 'Levels', 'Characters']
const entries = NAMES.map((label) => ({ id: label.toLowerCase(), label, icon: 'home' as const }))
const { hit: HIT } = editorTargets()
const touch = matchMedia('(any-pointer: coarse)').matches

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

async function open(layout: 'sidebar' | 'rail', width: number): Promise<void> {
  await page.viewport(1194, 834)
  mounted = mountFixture(NavFixture, { layout, width, entries, current: 'audio', counts: { schematic: 12 } })
  await settleLayout()
}

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]

describe('sidebar layout', () => {
  test('in the 224 px sidebar every name is whole and every row is the hit size', async () => {
    await open('sidebar', 224)
    expect(tabs()).toHaveLength(NAMES.length)
    for (const tab of tabs()) {
      const label = tab.querySelector<HTMLElement>('.label')
      expect(label, tab.textContent ?? '').not.toBeNull()
      expect(label?.scrollWidth, `${tab.textContent} is cut`).toBeLessThanOrEqual((label?.clientWidth ?? 0) + 1)
      expect(tab.getBoundingClientRect().height, `${tab.textContent} row`).toBeGreaterThanOrEqual(HIT)
    }
  })

  test('in the 76 px rail every name is whole under its icon, 52 px tall (56 with touch)', async () => {
    await open('rail', 76)
    for (const tab of tabs()) {
      const label = tab.querySelector<HTMLElement>('.label')
      expect(label?.scrollWidth, `${tab.textContent} is cut`).toBeLessThanOrEqual((label?.clientWidth ?? 0) + 1)
      expect(tab.getBoundingClientRect().height, `${tab.textContent} item`).toBeGreaterThanOrEqual(touch ? 56 : 52)
    }
  })
})
