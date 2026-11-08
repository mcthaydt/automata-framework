import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../../main.css'
import { publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import {
  arrived,
  createPointers,
  IPAD_PROFILES,
  type IpadProfile,
  REST,
  turned,
} from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../../../core'
import { type SuiteHandle, startSuite } from '../../../shell/boot'
import { createSuite } from '../../../shell/create-suite'
import { samplePorts } from '../../../testing/sample-ports'
import { studioFixtureFiles } from '../../../testing/studio-fixtures'
import { createStageRenderer } from '../stage/stage-renderer'
import { createStudio } from '../studio-suite-editor'

// The Studio on an iPad (editor suite spec §6.2, §12; EDS-q, EDS-r, EDS-s, EDS-x, EDS-aa): WebKit in an iPad context, real
// pointers and the real stage, in the suite's one shell over the fixture game. Wick's pose is dragged past his reach,
// his face and height are slid, a clip gains a key, an ease and a marker, the iPad turns in the middle of a key drag,
// and a new pose goes and comes back with Undo. What real hardware does with them stays the Owner's device pass.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/figure*/**/*.toml"\neditor = "studio"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
const FILES = { [EDITOR_LIST_PATH]: LIST, ...studioFixtureFiles() }

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(profile: IpadProfile) {
  await page.viewport(profile.width, profile.height)
  publishConditions(document.documentElement, { ...profile, mode: 'wide' } as never, REST)
  const ports = await samplePorts(FILES)
  // A change set is already open, so the first edit does not stop to ask for its title.
  await ports.changeSet?.begin('Studio journey')
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  const studio = createStudio({
    stage: createStageRenderer,
    frames: {
      request: (callback) => requestAnimationFrame((ms) => callback(ms / 1000)),
      cancel: cancelAnimationFrame,
    },
  })
  started = await startSuite(target, {
    window,
    document,
    ports,
    suite: createSuite({ editors: [studio as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  tab('Studio').click()
  await expect
    .poll(() => document.querySelector('[data-testid="studio-stage"][data-status="ready"]'))
    .not.toBeNull()
  await arrived()
  return { ports }
}

function tab(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} tab`)
  return found
}
const find = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}
const button = (name: string | RegExp): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('button, [role="radio"], [role="option"]')].find(
    (each) =>
      typeof name === 'string'
        ? (each.getAttribute('aria-label') ?? each.textContent?.trim()) === name
        : name.test(each.getAttribute('aria-label') ?? each.textContent ?? ''),
  )
  if (found === undefined) throw new Error(`no button ${name}`)
  return found
}
async function press(name: string | RegExp): Promise<void> {
  button(name).click()
  await arrived()
}
/** A slider by its visible label (the kit's slider names itself by `aria-labelledby`). */
function slider(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="slider"]')].find((each) => {
    const label = document.getElementById(each.getAttribute('aria-labelledby') ?? '')
    return label?.textContent?.trim().startsWith(name) === true
  })
  if (found === undefined) throw new Error(`no ${name} slider`)
  return found
}
/** Pointers on an element that moves while it is dragged: its box is taken once, where the drag began. */
function fixedBox(element: HTMLElement) {
  const box = element.getBoundingClientRect()
  return { getBoundingClientRect: () => box, dispatchEvent: (event: Event) => element.dispatchEvent(event) }
}
const read = async (ports: Awaited<ReturnType<typeof open>>['ports'], path: string) =>
  (await ports.workspace.read(path))?.text ?? ''
const undoLabel = (): string => button(/^Undo/).getAttribute('aria-label') ?? ''

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the Studio at $name',
  (profile) => {
    it('EDS-q: drags Wick’s hand past his reach: the handle turns amber with the shortfall, and the dragged target is what is saved', async () => {
      const { ports } = await open(profile)
      await press('Pose')
      await expect.poll(() => document.querySelectorAll('[data-handle]').length).toBe(7)
      const hand = find('[data-handle="handR"]')
      expect(hand.getAttribute('aria-label')).not.toMatch(/out of reach/)
      const pointers = createPointers(fixedBox(hand))
      // Across the stage, well beyond an arm's length.
      await pointers.drag(
        [
          { x: 22, y: 22 },
          { x: -30, y: 22 },
          { x: -120, y: 22 },
          { x: -230, y: 22 },
        ],
        { kind: 'touch' },
      )
      await arrived()
      const after = find('[data-handle="handR"]')
      expect(
        after.getAttribute('aria-label'),
        (await read(ports, 'content/figure-poses/guard-high.toml')) +
          (document.querySelector('[data-testid="studio-refusal"]')?.textContent ?? ''),
      ).toMatch(/out of reach/)
      expect(document.body.textContent).toMatch(/Out of reach by/)
      expect(undoLabel()).toMatch(/^Undo/)
      const saved = await read(ports, 'content/figure-poses/guard-high.toml')
      const [, x] = /\[effectors\.handR\]\npos = \[ (-?[\d.]+),/.exec(saved) ?? []
      expect(Number(x), 'the dragged target is what is saved, not the reach it fell short of').toBeLessThan(
        -0.4,
      )
    })

    it('EDS-r: slides his height with a finger: one step, and his face’s jaw into the face table', async () => {
      const { ports } = await open(profile)
      const height = slider('Height')
      const pointers = createPointers(fixedBox(height))
      const box = height.getBoundingClientRect()
      await pointers.drag([
        { x: box.width * 0.2, y: box.height / 2 },
        { x: box.width * 0.5, y: box.height / 2 },
        { x: box.width * 0.8, y: box.height / 2 },
      ])
      await arrived()
      const text = await read(ports, 'content/figures/wick.toml')
      expect(text).toMatch(/height = \d+/)
      expect(text).not.toMatch(/height = 120\b/)
      find('summary').click()
      await arrived()
      const jaw = slider('Jaw')
      jaw.focus()
      jaw.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await arrived()
      expect(await read(ports, 'content/figures/wick.toml')).toMatch(/jaw = /)
    })

    it('EDS-s: Animate: a key at the playhead with an ease and a marker, scrubbed', async () => {
      const { ports } = await open(profile)
      await press('guard')
      await press('roll')
      await press('Animate')
      const playhead = slider('Playhead')
      playhead.focus()
      for (let step = 0; step < 20; step++)
        playhead.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await arrived()
      await press('Add key')
      await press(/^Ease into this key/)
      await press('inOut')
      await press('Mark the playhead')
      const text = await read(ports, 'content/figure-clips/roll.toml')
      expect(text).toMatch(/t = 0\.2\n/)
      expect(text).toMatch(/ease = "inOut"/)
      expect(text).toMatch(/\[markers\]\ncontact = 0\.2/)
    })

    it('EDS-x: the iPad turns in the middle of a key drag: no remount, the chosen key and the playhead stay', async () => {
      await open(profile)
      await press('Animate')
      const stage = find('[data-testid="studio-stage"]')
      const key = find('[data-testid="studio-track"] .key:nth-of-type(2)')
      const contact = await createPointers(key).down('touch', { x: 22, y: 22 })
      await contact.move({ x: 60, y: 22 })
      const quarter = turned(profile)
      await page.viewport(quarter.width, quarter.height)
      await contact.cancel()
      await settleLayout()
      await arrived()
      expect(find('[data-testid="studio-stage"]'), 'the stage was not remounted').toBe(stage)
      expect(button(/^Animate/).getAttribute('aria-checked')).toBe('true')
      expect(document.querySelector('[data-testid="studio-track"] .key[aria-pressed="true"]')).not.toBeNull()
    })

    it('a double tap on a button leaves the page at scale 1 (the Owner: a double tap zoomed the iPad)', async () => {
      await open(profile)
      const target = button('Pose')
      await createPointers(target).tap({ x: 10, y: 10 }, { kind: 'touch' })
      await createPointers(target).tap({ x: 10, y: 10 }, { kind: 'touch' })
      await arrived()
      expect(window.visualViewport?.scale ?? 1).toBe(1)
      expect(getComputedStyle(document.documentElement).touchAction).toBe('manipulation')
    })

    it('EDS-aa: a new pose is a new file, and Undo takes the file away', async () => {
      const { ports } = await open(profile)
      await press('New pose')
      const input = find('input[autocomplete="off"]') as HTMLInputElement
      input.value = 'wave'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await press('Add')
      await expect.poll(async () => await read(ports, 'content/figure-poses/wave.toml')).not.toBe('')
      expect(undoLabel()).toMatch(/^Undo/)
      await press(/^Undo/)
      await expect.poll(async () => await read(ports, 'content/figure-poses/wave.toml')).toBe('')
    })
  },
)
