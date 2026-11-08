import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import NavFixture from '#src/testing/kit/NavFixture.svelte'
import { editorTargets } from '#src/testing/kit/targets.ts'

// The compact tab bar with production CSS: four tabs and More, each 56 px tall, the open one marked by a lime bar along
// its top (down its left edge when the bar stands), and More opening the rest in a sheet.
const NAMES = ['Tuner', 'Studio', 'Audio', 'Feel', 'Writer', 'Schematic', 'Sequence', 'Levels', 'Characters']
const { hit: HIT } = editorTargets()
const entries = NAMES.map((label) => ({ id: label.toLowerCase(), label, icon: 'home' as const }))

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

async function open(standing: boolean): Promise<void> {
  await (standing ? page.viewport(844, 390) : page.viewport(390, 844))
  mounted = mountFixture(NavFixture, {
    layout: 'tabbar' as const,
    standing,
    width: 72,
    entries,
    current: 'tuner',
  })
  await settleLayout()
}

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
const more = (): HTMLElement => {
  const button = document.querySelector<HTMLElement>('button.more')
  if (button === null) throw new Error('no More button')
  return button
}

describe('tab bar', () => {
  test('lying along the foot, four tabs and More share the width, each 56 px tall', async () => {
    await open(false)
    expect(tabs()).toHaveLength(4)
    for (const control of [...tabs(), more()]) {
      const box = control.getBoundingClientRect()
      expect(box.height, control.textContent ?? '').toBeGreaterThanOrEqual(56)
      expect(box.width, control.textContent ?? '').toBeCloseTo(390 / 5, 0)
    }
  })

  test('the open tab has a 2 px lime bar along its top, and no other tab has one', async () => {
    await open(false)
    const bar = (tab: HTMLElement) => getComputedStyle(tab, '::before')
    // The colour the token resolves to, read back through a probe so it compares as the browser writes it.
    const probe = document.body.appendChild(document.createElement('i'))
    probe.style.backgroundColor = 'var(--lime)'
    const lime = getComputedStyle(probe).backgroundColor
    probe.remove()
    const openTab = tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')
    expect(openTab?.textContent).toContain('Tuner')
    expect(bar(openTab as HTMLElement).height).toBe('2px')
    expect(bar(openTab as HTMLElement).backgroundColor).toBe(lime)
    for (const tab of tabs().filter((each) => each !== openTab)) expect(bar(tab).content).toBe('none')
  })

  test('standing at the left of a phone held sideways, the bar is a column and the lime bar runs down the open tab', async () => {
    await open(true)
    const column = document.querySelector<HTMLElement>('[role="tablist"]')
    expect(column && getComputedStyle(column).flexDirection).toBe('column')
    const openTab = tabs().find((tab) => tab.getAttribute('aria-selected') === 'true') as HTMLElement
    const bar = getComputedStyle(openTab, '::before')
    expect(bar.width).toBe('2px')
    expect(bar.left).toBe('0px')
  })

  test('More opens the rest by name in a sheet that rises from the foot, and choosing one closes it', async () => {
    await open(false)
    more().click()
    await settleLayout()
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(sheet).not.toBeNull()
    const names = [...(sheet?.querySelectorAll<HTMLElement>('.more-item') ?? [])].map((item) =>
      item.textContent?.trim(),
    )
    expect(names).toEqual(NAMES.slice(4))
    const box = (sheet as HTMLElement).getBoundingClientRect()
    expect(box.bottom).toBeCloseTo(844, 0)
    for (const item of sheet?.querySelectorAll<HTMLElement>('.more-item') ?? [])
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(HIT)
    sheet?.querySelector<HTMLElement>('.more-item')?.click()
    await settleLayout()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
