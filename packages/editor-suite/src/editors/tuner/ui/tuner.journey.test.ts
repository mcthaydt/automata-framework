import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../../main.css'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import {
  arrived,
  createPointers,
  IPAD_PROFILES,
  type IpadProfile,
  REST,
  turned,
} from '@mcthaydt/automata-editor-kit/testing'
import { publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../../../core'
import { type SuiteHandle, startSuite } from '../../../shell/boot'
import { createSuite } from '../../../shell/create-suite'
import { samplePorts } from '../../../testing/sample-ports'
import { TUNING_FIXTURE, tunerFixtureFiles } from '../../../testing/tuner-fixtures'
import { createTuner } from '../tuner-suite-editor'

// The Tuner on an iPad (editor suite spec §6.1, §12; EDS-b, EDS-c, EDS-x): WebKit in an iPad context, real pointers, the
// suite's one shell over a tuning file. A slider is dragged with a finger and the drag is one undo step; a number typed past
// its bound is refused with the bound named and nothing is written; and the iPad turns in the middle of a drag, which the
// drag survives (no remount, one step, the value it was dragged to). What real hardware does stays the Owner's device pass.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit", "ask"]\ngates = []\nchecks = []\n`
const PATH = 'content/tuning.toml'

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
  const ports = await samplePorts({ ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST })
  // A change set is already open, so the first edit does not stop to ask for its title.
  await ports.changeSet?.begin('Tuner journey')
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports,
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (each) => (each.getAttribute('aria-label') ?? each.textContent?.trim()) === 'Tuner',
  )
  tab?.click()
  await expect.poll(() => document.querySelector('[data-testid="tuner-rows"]')).not.toBeNull()
  await arrived()
  return { ports }
}

const find = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}
const slider = (name: string): HTMLElement => find(`[data-testid="tuner-row-${name}"] [role="slider"]`)
const undoButton = (): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find((each) =>
    /^Undo/.test(each.getAttribute('aria-label') ?? each.textContent ?? ''),
  )
  if (found === undefined) throw new Error('no Undo button')
  return found
}
/** Pointers on an element that moves while it is dragged: its box is taken once, where the drag began. */
function fixedBox(element: HTMLElement) {
  const box = element.getBoundingClientRect()
  return { getBoundingClientRect: () => box, dispatchEvent: (event: Event) => element.dispatchEvent(event) }
}
const read = async (ports: Awaited<ReturnType<typeof open>>['ports']) =>
  (await ports.workspace.read(PATH))?.text ?? ''

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the Tuner at $name',
  (profile) => {
    it('EDS-b: a finger drags a slider: only that number changes, in one undo step that Undo takes back', async () => {
      const { ports } = await open(profile)
      const handle = slider('MAX_RUN')
      const box = handle.getBoundingClientRect()
      await createPointers(fixedBox(handle)).drag([
        { x: box.width * 0.2, y: box.height / 2 },
        { x: box.width * 0.5, y: box.height / 2 },
        { x: box.width * 0.8, y: box.height / 2 },
      ])
      await arrived()
      const written = await read(ports)
      expect(written).not.toBe(TUNING_FIXTURE)
      const [, value] = /MAX_RUN = \{ value = (\d+),/.exec(written) ?? []
      expect(Number(value)).toBeGreaterThan(384)
      // Only that number moved: the rest of the file is the original around it.
      expect(written.replace(/MAX_RUN = \{ value = \d+,/, 'MAX_RUN = { value = 384,')).toBe(TUNING_FIXTURE)
      expect(undoButton().getAttribute('aria-label')).toMatch(/MAX_RUN/)
      undoButton().click()
      await arrived()
      expect(await read(ports)).toBe(TUNING_FIXTURE)
      expect(
        undoButton().hasAttribute('disabled') || undoButton().getAttribute('aria-disabled') === 'true',
      ).toBe(true)
    })

    it('EDS-c: a number typed past its bound is refused with the bound named, and nothing is written', async () => {
      const { ports } = await open(profile)
      const box = find(
        '[data-testid="tuner-row-MAX_RUN"] input[type="number"], [data-testid="tuner-row-MAX_RUN"] [role="spinbutton"]',
      )
      await userEvent.click(box)
      await userEvent.keyboard('{Control>}a{/Control}9000{Enter}')
      await arrived()
      expect(await read(ports)).toBe(TUNING_FIXTURE)
      expect(find('[data-testid="tuner-row-MAX_RUN"]').textContent).toMatch(/Must be at most 768/)
    })

    it('EDS-x: the iPad turns in the middle of a slider drag: no remount, and the drag finishes as one step', async () => {
      const { ports } = await open(profile)
      const rows = find('[data-testid="tuner-rows"]')
      const handle = slider('MAX_RUN')
      const box = handle.getBoundingClientRect()
      const contact = await createPointers(fixedBox(handle)).down('touch', {
        x: box.width * 0.2,
        y: box.height / 2,
      })
      await contact.move({ x: box.width * 0.5, y: box.height / 2 })
      const quarter = turned(profile)
      await page.viewport(quarter.width, quarter.height)
      await settleLayout()
      await contact.move({ x: box.width * 0.8, y: box.height / 2 })
      await contact.release()
      await arrived()
      expect(find('[data-testid="tuner-rows"]'), 'the rows were not remounted').toBe(rows)
      const written = await read(ports)
      const [, value] = /MAX_RUN = \{ value = (\d+),/.exec(written) ?? []
      expect(Number(value), 'the drag went on past the turn').toBeGreaterThan(384)
      undoButton().click()
      await arrived()
      expect(await read(ports), 'one Undo takes the whole drag back').toBe(TUNING_FIXTURE)
    })
  },
)
