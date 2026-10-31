// The Items screen's layout with production CSS in Chromium, WebKit and Firefox (DESIGN.md §9.3, GAME-3D.1e part
// 5b), at 844 × 390 and the compact 780 × 270: every slot at least 44 px, the corner Back fixed and in view, the
// contents inside the declared scroll region, and the arrow keys steering the grid by the slots' boxes.
import '@mcthaydt/automata-ui/theme.css'
import '@mcthaydt/automata-game'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { newGame } from '../state/save.ts'
import ItemsScreen from './ItemsScreen.svelte'

const SAVE = {
  ...newGame(),
  items: { sling: true, bombs: true, hookchain: true },
  ammo: { pellets: 30, bombs: 10 },
  equipped: 'sling' as const,
  embers: 999,
  hearts: { max: 6, pieces: ['a', 'b', 'c'] },
}

const rect = (element: Element | null): DOMRect => {
  if (element === null) throw new Error('missing element')
  return element.getBoundingClientRect()
}
const slots = () => [...document.querySelectorAll<HTMLButtonElement>('[data-slot]')]

describe('the Items screen (GAME-3D.1e part 5b)', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    document.body.replaceChildren()
  })

  async function open(width: number, height: number): Promise<void> {
    await page.viewport(width, height)
    shown = mount(ItemsScreen, {
      target: document.body,
      props: { save: SAVE, onEquip: () => {}, onBack: () => {} },
    })
    flushSync()
    await document.fonts.ready
  }

  for (const [width, height] of [
    [844, 390],
    [780, 270],
  ] as const) {
    it(`keeps every slot 44 px or more and the corner Back in view at ${width} x ${height}`, async () => {
      await open(width, height)
      expect(slots()).toHaveLength(5)
      for (const slot of slots()) {
        expect(rect(slot).width, slot.dataset.slot).toBeGreaterThanOrEqual(44)
        expect(rect(slot).height, slot.dataset.slot).toBeGreaterThanOrEqual(44)
      }
      const back = rect(document.querySelector('[data-testid="corner-back"]'))
      expect(back.height).toBeGreaterThanOrEqual(44)
      expect(back.top).toBeGreaterThanOrEqual(0)
      expect(back.bottom).toBeLessThanOrEqual(height)
    })

    it(`holds what does not fit inside its declared scroll region at ${width} x ${height}`, async () => {
      await open(width, height)
      const region = document.querySelector<HTMLElement>('[data-testid="items-scroll"]')
      expect(region?.hasAttribute('data-scroll-region')).toBe(true)
      const box = rect(region)
      expect(box.bottom).toBeLessThanOrEqual(height + 0.5)
      expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(height)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
      // Everything in it can be scrolled to: its content's foot is reachable inside the region.
      const facts = rect(document.querySelector('.b3-items__facts'))
      expect(facts.bottom - box.top).toBeLessThanOrEqual((region?.scrollHeight ?? 0) + 0.5)
    })
  }

  it('steers focus over the grid with the arrow keys', async () => {
    await open(844, 390)
    const [sword, shield, sling] = slots()
    sword?.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(shield)
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(sling)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(shield)
  })
})
