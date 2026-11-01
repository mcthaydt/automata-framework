import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, type PlanRendererFactory } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { writable } from 'svelte/store'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../core'
import { createStudio } from '../editors/studio/studio-suite-editor'
import { createTuner } from '../editors/tuner/tuner-suite-editor'
import { axeViolations } from '../testing/a11y'
import depot from '../testing/fixtures/depot.af-sector.json?raw'
import platformer from '../testing/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '../testing/StandInLevelCanvas.svelte'
import { FLOORFIFTY_SAMPLE, samplePorts } from '../testing/sample-ports'
import { studioFixtureFiles } from '../testing/studio-fixtures'
import { tunerFixtureFiles } from '../testing/tuner-fixtures'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

// An accessibility pass (axe-core) over the suite's Home and each 1.0 editor open in the one shell, in Chromium, WebKit
// and Firefox at the phone and the wide size (editor suite spec §12, plan EDS.10 step 2). Colour contrast is axe's
// blind spot over canvases and is the kit's own test; every other rule runs.

const row = (glob: string, editor: string) =>
  `[[file]]\nglob = "${glob}"\neditor = "${editor}"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
const list = (...rows: string[]) => `format = "af-editors/1"\n${rows.join('\n')}`

const stage = async () => ({
  paused: writable(false),
  show: () => {},
  pose: () => {},
  face: () => {},
  look: () => {},
  resize: () => {},
  render: () => {},
  destroy: () => {},
})
const planRenderer: PlanRendererFactory = async () => ({
  paused: {
    subscribe: (run: (value: boolean) => void) => {
      run(false)
      return () => {}
    },
  },
  draw: () => {},
  resize: () => {},
  destroy: () => {},
})

interface Case {
  readonly name: string
  readonly files: Record<string, string>
  readonly editors: () => SuiteEditor<unknown>[]
  readonly tab?: string
  readonly ready?: string
}
const CASES: readonly Case[] = [
  { name: 'Home', files: FLOORFIFTY_SAMPLE, editors: () => [] },
  {
    name: 'Tuner',
    files: { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: list(row('content/tuning.toml', 'tuner')) },
    editors: () => [createTuner() as SuiteEditor<unknown>],
    tab: 'Tuner',
    ready: '[data-testid="tuner-rows"]',
  },
  {
    name: 'Studio',
    files: { ...studioFixtureFiles(), [EDITOR_LIST_PATH]: list(row('content/figure*/**/*.toml', 'studio')) },
    editors: () => [
      createStudio({ stage, frames: { request: () => 0, cancel: () => {} } }) as SuiteEditor<unknown>,
    ],
    tab: 'Studio',
    ready: '[data-testid="studio-stage"]',
  },
  {
    name: 'Levels 2D',
    files: {
      [EDITOR_LIST_PATH]: list(row('content/levels/*.af2d.json', 'levels-2d')),
      'content/levels/world.af2d.json': platformer,
    },
    editors: () => [
      createLevels2d({ ids: { next: () => 'thing-1' }, canvas: StandInLevelCanvas }) as SuiteEditor<unknown>,
    ],
    tab: 'Levels',
    ready: '[data-testid="level-canvas"]',
  },
  {
    name: 'Levels 3D',
    files: {
      [EDITOR_LIST_PATH]: list(row('content/levels/*.af-sector.json', 'levels-3d')),
      'content/levels/depot.af-sector.json': depot,
    },
    editors: () => [
      createLevels3d({
        now: () => 0,
        renderer: planRenderer,
        schedule: () => () => {},
      }) as SuiteEditor<unknown>,
    ],
    tab: 'Levels',
    ready: '[data-testid="plan-canvas"]',
  },
]

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize, which: Case) {
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, REST)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(which.files),
    suite: createSuite({ editors: which.editors() }),
    sample: which.name === 'Home',
  })
  await settleLayout()
  if (which.tab !== undefined && which.ready !== undefined) {
    const ready = which.ready
    const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === which.tab,
    )
    if (found === undefined) throw new Error(`no ${which.tab} tab`)
    found.click()
    await expect.poll(() => document.querySelector(ready)).not.toBeNull()
    await settleLayout()
  }
}

const SAMPLE_SIZES = SIZES.filter(
  (size) => size.name === 'phone-portrait' || size.name === 'ipad-pro-11-landscape',
)

describe.each(SAMPLE_SIZES)('Suite accessibility at $name ($width x $height)', (size) => {
  test.each(CASES)('$name has no axe violations', async (which) => {
    await open(size, which)
    expect(await axeViolations(document.body)).toEqual([])
  })
})
