import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import ToolbarFixture from '#src/testing/kit/ToolbarFixture.svelte'
import { editorTargets } from '#src/testing/kit/targets.ts'

// The floating toolbar with production CSS (spec 7.6): over a stage 600 px wide it is one row with the brush size beside
// the tools; over one 480 px wide or less (an iPad on its side with the list and the inspector open) the brush size sits
// under a hairline with its words, "Brush size", and every button is whole and a full target either way.
const { hit: HIT } = editorTargets()
const BUTTON = HIT === 28 ? 32 : HIT

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

async function open(width: number): Promise<void> {
  await page.viewport(1194, 834)
  mounted = mountFixture(ToolbarFixture, { width })
  await settleLayout()
}

const box = (selector: string): DOMRect => {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found.getBoundingClientRect()
}
const second = (): HTMLElement =>
  document.querySelector('[role="group"][aria-label="Brush size"]') as HTMLElement
const words = (): HTMLElement => second().querySelector('.words') as HTMLElement

describe('the floating toolbar', () => {
  test('over a 600 px stage it is one row, the brush size beside the tools with no words', async () => {
    await open(600)
    const tools = box('[data-testid="tools"]')
    expect(tools.height).toBeLessThan(BUTTON * 2)
    expect(getComputedStyle(words()).display).toBe('none')
    const tool = box('[role="radio"]')
    expect(second().getBoundingClientRect().top).toBeLessThan(tool.bottom)
  })

  test('over a stage 480 px wide or less the brush size takes a row under a hairline, with its words', async () => {
    for (const width of [480, 420]) {
      await open(width)
      const tools = box('[data-testid="tools"]')
      expect(getComputedStyle(words()).display, `${width}: words`).toBe('block')
      expect(words().textContent).toBe('Brush size')
      const tool = box('[role="radio"]')
      expect(second().getBoundingClientRect().top, `${width}: second row`).toBeGreaterThanOrEqual(
        tool.bottom - 0.5,
      )
      expect(getComputedStyle(second()).borderTopWidth).toBe('1px')
      // Whole: every button inside the toolbar and inside the stage.
      const stage = box('[data-testid="stage"]')
      expect(tools.left, `${width}: left`).toBeGreaterThanOrEqual(stage.left - 0.5)
      expect(tools.right, `${width}: right`).toBeLessThanOrEqual(stage.right + 0.5)
      await mounted?.unmount()
      mounted = undefined
    }
  })

  test('every button is whole and at least the control size, in both layouts', async () => {
    for (const width of [600, 420]) {
      await open(width)
      const stage = box('[data-testid="stage"]')
      for (const control of document.querySelectorAll<HTMLElement>(
        '[data-testid="tools"] button, [data-testid="zoom"] button',
      )) {
        const rect = control.getBoundingClientRect()
        const name = `${width}: ${control.getAttribute('aria-label') ?? control.textContent}`
        expect(rect.width, name).toBeGreaterThanOrEqual(BUTTON - 0.5)
        expect(rect.height, name).toBeGreaterThanOrEqual(BUTTON - 0.5)
        expect(rect.left, name).toBeGreaterThanOrEqual(stage.left - 0.5)
        expect(rect.right, name).toBeLessThanOrEqual(stage.right + 0.5)
        expect(rect.bottom, name).toBeLessThanOrEqual(stage.bottom + 0.5)
      }
      await mounted?.unmount()
      mounted = undefined
    }
  })

  test('the chosen tool is reversed, ink on the window colour, and the zoom sits at the bottom right', async () => {
    await open(600)
    const chosen = document.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') as HTMLElement
    const style = getComputedStyle(chosen)
    const reversed = document.createElement('i')
    reversed.style.color = 'var(--bg)'
    reversed.style.backgroundColor = 'var(--ink)'
    document.body.append(reversed)
    const want = getComputedStyle(reversed)
    expect([style.backgroundColor, style.color]).toEqual([want.backgroundColor, want.color])
    reversed.remove()
    const zoom = box('[data-testid="zoom"]')
    const stage = box('[data-testid="stage"]')
    expect(stage.right - zoom.right).toBeLessThan(24)
    expect(stage.bottom - zoom.bottom).toBeLessThan(24)
  })
})
