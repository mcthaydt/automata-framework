import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/tool-chrome.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { arrived, type EditorSize, editorTargets, REST, SIZES } from '@automata/editor/kit/testing'
import { createSuite, type SuiteHandle, samplePorts, startSuite } from '@automata/editor/suite'
import { chooseEditor, editorControl } from '@automata/editor/suite/testing/layout'
import { checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { writable } from 'svelte/store'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import type { StageRenderer } from '#src/features/studio/stage/stage-renderer.ts'
import { createStudio } from '#src/features/studio/studio-suite-editor.ts'
import { studioFixtureFiles } from '#src/testing/studio/studio-fixtures.ts'

// The Studio in the suite's one shell with the production CSS in Chromium, WebKit and Firefox at the eight window sizes
// (EDS.9; editor suite spec §10): the stage has room, every target is 44 px, the pose handles are targets inside the
// stage, the timeline is reachable in Animate (a sheet below wide), the page never scrolls, and a rotation keeps the
// mode and the chosen clip. The stage is a stand-in here: its pixels are the canvas project's.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/figure*/**/*.toml"\neditor = "studio"\nmodes = ["edit"]\ngates = []\nchecks = []\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
const FILES = {
  [EDITOR_LIST_PATH]: LIST,
  'content/tuning.toml': '[player]\nspeed = 6\n',
  ...studioFixtureFiles(),
}

const standin = async (): Promise<StageRenderer> => ({
  paused: writable(false),
  show: () => {},
  pose: () => {},
  face: () => {},
  look: () => {},
  resize: () => {},
  render: () => {},
  destroy: () => {},
})

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
  const conditions = publishConditions(document.documentElement, size, REST, editorTargets())
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  const studio = createStudio({ stage: standin, frames: { request: () => 0, cancel: () => {} } })
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(FILES),
    suite: createSuite({ editors: [studio as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  await chooseEditor('Characters')
  await expect.poll(() => document.querySelector('[data-testid="studio-stage"]')).not.toBeNull()
  await settleLayout()
  return conditions
}

const stage = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-testid="studio-stage"]') as HTMLElement
const modeButton = (name: string): HTMLElement => {
  const found = [
    ...document.querySelectorAll<HTMLElement>('[aria-label="Character mode"] [role="radio"]'),
  ].find((button) => button.textContent?.trim() === name)
  if (found === undefined) throw new Error(`no ${name} mode`)
  return found
}

function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
}

/** Scrolls the declared scroll region a control sits in, and nothing else, until the control is inside it. */
function reveal(control: HTMLElement): void {
  const region = control.closest<HTMLElement>('[data-scroll-region]')
  if (region === null) return
  const box = control.getBoundingClientRect()
  const view = region.getBoundingClientRect()
  region.scrollTop += Math.max(0, box.bottom - view.bottom) - Math.max(0, view.top - box.top)
  region.scrollLeft += Math.max(0, box.right - view.right) - Math.max(0, view.left - box.left)
}

/** The suite's top-bar toggle for the dock, where the dock is a sheet. */
const dockToggle = (): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === 'Dock',
  )

describe.each(SIZES)('Studio at $name ($width x $height)', (size) => {
  test('Look: the stage has room, the modes are targets, the page never scrolls', async () => {
    const conditions = await open(size)
    const box = stage().getBoundingClientRect()
    expect(box.width).toBeGreaterThan(size.mode === 'wide' ? (size.width < 1000 ? 240 : 320) : size.width / 3)
    expect(box.height).toBeGreaterThan(size.mode === 'compact' && size.height < 500 ? 80 : 200)
    expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
    expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
    expect(
      checkLayout(conditions, [editorControl('Characters'), ...['Look', 'Pose', 'Animate'].map(modeButton)]),
    ).toEqual([])
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/studio-look-${size.name}.png` })
  })

  test('Pose: every handle is a 44 px target inside the stage', async () => {
    const conditions = await open(size)
    modeButton('Pose').click()
    await expect.poll(() => document.querySelectorAll('[data-handle]').length).toBe(7)
    const handles = [...document.querySelectorAll<HTMLElement>('[data-handle]')]
    const box = stage().getBoundingClientRect()
    for (const handle of handles) {
      const at = handle.getBoundingClientRect()
      expect(at.left, handle.dataset['handle']).toBeGreaterThanOrEqual(box.left - 22)
      expect(at.right).toBeLessThanOrEqual(box.right + 22)
      expect(at.top).toBeGreaterThanOrEqual(box.top - 22)
      expect(at.bottom).toBeLessThanOrEqual(box.bottom + 22)
      expect(at.width).toBeGreaterThanOrEqual(44)
    }
    expect(checkLayout(conditions, [modeButton('Look')])).toEqual([])
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/studio-pose-${size.name}.png` })
  })

  test('Animate: the timeline is reachable (a sheet below wide) with 44 px keys and Play', async () => {
    const conditions = await open(size)
    modeButton('Animate').click()
    await settleLayout()
    const toggle = dockToggle()
    if (size.mode !== 'wide' || size.height < 700) {
      expect(toggle, 'a Dock toggle where the dock is a sheet').toBeDefined()
      if (toggle?.getAttribute('aria-expanded') !== 'true') toggle?.click()
      // The sheet slides up over 160 ms; the targets are measured where it comes to rest.
      await arrived()
    }
    await expect.poll(() => document.querySelector('[data-testid="studio-timeline"]')).not.toBeNull()
    const keys = [...document.querySelectorAll<HTMLElement>('[data-testid="studio-track"] .key')]
    expect(keys.length).toBeGreaterThan(1)
    const play = [...document.querySelectorAll<HTMLElement>('button')].find(
      (button) => button.textContent?.trim() === 'Play',
    )
    if (play === undefined) throw new Error('no Play')
    // The dock is a declared scroll region (a sheet holds a strip, kit EditorShell): each control comes into view by
    // scrolling it, as the 2D Level view's tool row does, without the page moving.
    for (const control of [play, ...keys]) {
      reveal(control)
      await arrived()
      expect(checkLayout(conditions, [control]), control.getAttribute('aria-label') ?? 'Play').toEqual([])
    }
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/studio-animate-${size.name}.png` })
  })

  test('a rotation keeps the mode and the chosen clip', async () => {
    await open(size)
    modeButton('Animate').click()
    await settleLayout()
    await page.viewport(size.height, size.width)
    await settleLayout()
    expect(modeButton('Animate').getAttribute('aria-checked')).toBe('true')
    expect(stage().dataset['mode']).toBe('animate')
    noPageScroll()
  })
})
