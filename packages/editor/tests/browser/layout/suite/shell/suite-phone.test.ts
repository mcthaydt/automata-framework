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

const targets = editorTargets()

// The suite on a phone (editors v2): the header's title names the game, whole; the tab bar lists only the game's
// editors, 56 px along the foot; held sideways, where a bar along the foot would eat a sixth of the height, it stands at the
// left as a 72 px column and the stage keeps at least 85 % of the window's height. Started the way `main.ts` starts it,
// with the real window.

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

  test('the header names the game, whole', async () => {
    await open(size)
    const bar = region('topbar')
    const name = [...bar.querySelectorAll<HTMLElement>('.name')].find(
      (node) => node.textContent?.trim() === NAME,
    )
    if (name === undefined) throw new Error(`the header does not say ${NAME}`)
    const box = name.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.right).toBeLessThanOrEqual(size.width)
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1)
  })

  test(
    landscape
      ? 'the tabs stand in a 72 px column at the left, and the stage keeps 85 % of the height'
      : 'the tabs are the game’s editors, 44 px each, in a 56 px bar at the foot',
    async () => {
      const conditions = await open(size)
      const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
      expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Tuner', 'Levels', 'Characters'])
      for (const tab of tabs) expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
      const rail = region('rail').getBoundingClientRect()
      if (landscape) {
        expect(Math.round(rail.width)).toBe(72)
        expect(rail.left).toBeLessThanOrEqual(0.5)
        expect(region('canvas').getBoundingClientRect().height).toBeGreaterThanOrEqual(size.height * 0.85)
      } else {
        expect(Math.round(rail.height)).toBe(56)
        expect(rail.bottom).toBeGreaterThan(size.height - 1)
      }
      expect(checkLayout(conditions, [home(), ...tabs])).toEqual([])
      expect(document.documentElement.scrollLeft).toBe(0)
      expect(document.documentElement.scrollTop).toBe(0)
      await page.screenshot({ path: `.vitest/shots/suite-phone-${size.name}.png` })
    },
  )
})
