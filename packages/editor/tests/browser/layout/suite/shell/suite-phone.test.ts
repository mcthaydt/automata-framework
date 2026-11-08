import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { SAMPLE_GAME, samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { editorsMenu } from '#src/testing/suite/suite-layout.ts'

const targets = editorTargets()

// The suite on a phone (spec 10.3, V4): the top bar names the game; the bottom bar lists only the game's editors; in
// phone landscape, where a tab bar would eat a sixth of the height, the editors fold into a menu in the top bar and the
// stage keeps at least 85 % of the window's height. Started the way `main.ts` starts it, with the real window.

const PHONES = SIZES.filter((size) => size.formFactor.startsWith('phone'))
const NAME = 'Moss Gate'

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(SAMPLE_GAME),
    suite: createSuite({
      editors: [createTuner(), createLevels2d({ ids: counterIds() })] as SuiteEditor<unknown>[],
    }),
    sample: false,
    game: NAME,
  })
  await settleLayout()
  return conditions
}

const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const home = (): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.getAttribute('aria-label') === 'Home',
  )
  if (found === undefined) throw new Error('no Home button')
  return found
}

describe.each(PHONES)('Suite on a phone: $name ($width x $height)', (size) => {
  const landscape = size.width > size.height

  test('the top bar names the game, whole', async () => {
    await open(size)
    const bar = region('topbar')
    const name = [...bar.querySelectorAll<HTMLElement>('*')].find((node) => node.textContent?.trim() === NAME)
    if (name === undefined) throw new Error(`the top bar does not say ${NAME}`)
    const box = name.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.right).toBeLessThanOrEqual(size.width)
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1)
  })

  test(
    landscape
      ? 'the editors fold into a menu in the top bar, and the stage keeps 85 % of the height'
      : 'the tabs are the game’s editors, one Levels, 44 px each, in a 64 px bar at the foot',
    async () => {
      const conditions = await open(size)
      if (landscape) {
        expect(document.querySelector('[role="tablist"]')).toBeNull()
        const stage = region('canvas').getBoundingClientRect()
        expect(stage.height).toBeGreaterThanOrEqual(size.height * 0.85)
        const menu = editorsMenu()
        if (menu === undefined) throw new Error('no Editors menu in the top bar')
        const box = menu.getBoundingClientRect()
        expect(box.width).toBeGreaterThanOrEqual(targets.hit)
        expect(box.height).toBeGreaterThanOrEqual(targets.hit)
        menu.click()
        await arrived()
        const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        expect(items.map((item) => item.textContent?.trim())).toEqual(['Tuner', 'Levels', 'Characters'])
        for (const item of items)
          expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
        items[0]?.click()
        await expect.poll(() => document.querySelector('[data-testid="tuner-rows"]')).not.toBeNull()
        await arrived()
        expect(checkLayout(conditions, [home(), menu])).toEqual([])
      } else {
        const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
        expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Tuner', 'Levels', 'Characters'])
        for (const tab of tabs) expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
        expect(Math.round(region('rail').getBoundingClientRect().height)).toBe(64)
        expect(checkLayout(conditions, [home(), ...tabs])).toEqual([])
      }
      expect(document.documentElement.scrollLeft).toBe(0)
      expect(document.documentElement.scrollTop).toBe(0)
      await page.screenshot({ path: `.vitest/shots/suite-phone-${size.name}.png` })
    },
  )
})
