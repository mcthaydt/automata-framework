import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { SAMPLE_GAME, samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { chooseEditor } from '#src/testing/suite/suite-layout.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The suite with the production CSS in a real browser at the editors' window sizes:
// region boxes, the rail (the page's two editors), the 64 px tab bar, 44 px targets, no page scroll and no remount on rotation. jsdom
// has no layout, so only this file checks room. Started the way `main.ts` starts it, with the real window.

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize, files: Record<string, string> = SAMPLE_GAME) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    // The editors `main.ts` registers.
    suite: createSuite({
      editors: [createTuner(), createLevels2d({ ids: counterIds() })] as SuiteEditor<unknown>[],
    }),
    sample: true,
  })
  await settleLayout()
  return conditions
}

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
const home = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('button[aria-current="page"]')
  if (found === null) throw new Error('no Home button')
  return found
}

describe.each(SIZES)('Suite at $name ($width x $height)', (size) => {
  test('the shell mode, a whole tab per editor of at least the hit size, Home reachable, nothing clipped, no page scroll', async () => {
    const conditions = await open(size)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    const all = tabs()
    expect(all.map((tab) => tab.textContent?.trim())).toEqual(['Tuner', 'Levels'])
    for (const tab of all) {
      const box = tab.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
      // Half a pixel for WebKit's and Firefox's sub-pixel boxes.
      expect(box.right, `${tab.textContent} is whole`).toBeLessThanOrEqual(size.width + 0.5)
      expect(box.bottom, `${tab.textContent} is whole`).toBeLessThanOrEqual(size.height + 0.5)
    }
    expect(checkLayout(conditions, [home(), ...all])).toEqual([])
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/suite-home-${size.name}.png` })
  })

  test('a double tap does not zoom the page and a hold does not select the chrome (the Owner, on an iPad)', async () => {
    await open(size)
    expect(getComputedStyle(document.documentElement).touchAction).toBe('manipulation')
    expect(getComputedStyle(document.body).touchAction).toBe('manipulation')
    expect(
      getComputedStyle(home()).userSelect || getComputedStyle(home()).getPropertyValue('-webkit-user-select'),
    ).toBe('none')
    expect(getComputedStyle(home()).getPropertyValue('-webkit-touch-callout') || 'none').toBe('none')
  })

  test('the editors are a 224 px sidebar in wide, a 76 px rail in medium, a 56 px bar at the foot in compact and a 72 px column at the left on a phone held sideways', async () => {
    await open(size)
    const list = document.querySelector<HTMLElement>('[role="tablist"]')
    if (list === null) throw new Error('no editors list')
    const bar = document.querySelector<HTMLElement>('[data-region="rail"]')?.getBoundingClientRect()
    if (bar === undefined) throw new Error('no rail region')
    const sideways = size.formFactor === 'phone-landscape'
    if (size.mode === 'compact' && !sideways) {
      expect(list).toHaveAttribute('aria-orientation', 'horizontal')
      expect(Math.round(bar.height)).toBe(56)
      expect(Math.round(bar.bottom)).toBeLessThanOrEqual(size.height)
    } else {
      expect(list).toHaveAttribute('aria-orientation', 'vertical')
      expect(bar.left).toBeLessThanOrEqual(0.5)
      expect(Math.round(bar.width)).toBe(size.mode === 'wide' ? 224 : size.mode === 'medium' ? 76 : 72)
    }
  })

  test("the list's problem and a read-only file stay inside the window", async () => {
    const conditions = await open(size, {
      [EDITOR_LIST_PATH]:
        'format = "af-editors/1"\n[[file]]\nglob = "a.toml"\neditor = "tuner"\nmodes = ["edit"]\nchecks = []\n',
    })
    const alert = document.querySelector<HTMLElement>('[role="alert"]')
    expect(alert?.getBoundingClientRect().right ?? Infinity).toBeLessThanOrEqual(size.width)
    expect(checkLayout(conditions, [home()])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/suite-problem-${size.name}.png` })
  })
})

describe('Suite rotation', () => {
  test('1194 x 834 to 834 x 1194 keeps Home and the chosen entry and remounts nothing', async () => {
    const [landscape, portrait] = [SIZES[0], SIZES[4]] as [EditorSize, EditorSize]
    await open(landscape)
    await chooseEditor('Tuner')
    await expect.poll(() => document.querySelector('[data-testid="tuner-rows"]')).not.toBeNull()
    await settleLayout()
    const shell = document.querySelector('[data-editor-shell]')
    const page1 = document.querySelector('[data-testid="tuner-rows"]')
    await page.viewport(portrait.width, portrait.height)
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toBe(shell)
    expect(document.querySelector('[data-testid="tuner-rows"]')).toBe(page1)
    expect(document.querySelector('[aria-selected="true"]')?.textContent?.trim()).toBe('Tuner')
  })
})
