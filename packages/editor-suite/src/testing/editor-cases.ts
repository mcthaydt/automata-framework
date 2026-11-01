import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, type PlanRendererFactory } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { type EditorSize, REST } from '@mcthaydt/automata-editor-kit/testing'
import { publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { writable } from 'svelte/store'
import { expect } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../core'
import { createStudio } from '../editors/studio/studio-suite-editor'
import { createTuner } from '../editors/tuner/tuner-suite-editor'
import { type SuiteHandle, startSuite } from '../shell/boot'
import { createSuite } from '../shell/create-suite'
import depot from './fixtures/depot.af-sector.json?raw'
import platformer from './fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from './StandInLevelCanvas.svelte'
import { SAMPLE_GAME, samplePorts } from './sample-ports'
import { studioFixtureFiles } from './studio-fixtures'
import { tunerFixtureFiles } from './tuner-fixtures'

// The suite with Home or one of the 1.0 editors open, started the way `main.ts` starts it, for the real-browser tests that
// walk every editor the same way (the axe pass, the focus order; plan EDS.10). The canvases are stand-ins: their pixels
// are the canvas projects' own.

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

export interface Case {
  readonly name: string
  readonly files: Record<string, string>
  readonly editors: () => SuiteEditor<unknown>[]
  readonly tab?: string
  readonly ready?: string
}
export const EDITOR_CASES: readonly Case[] = [
  { name: 'Home', files: SAMPLE_GAME, editors: () => [] },
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

export interface OpenSuite {
  readonly handle: SuiteHandle
  readonly target: HTMLElement
}

/** Opens the suite at `size` with `which` shown; the caller disposes `handle` and removes `target`. */
export async function openCase(size: EditorSize, which: Case): Promise<OpenSuite> {
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, REST)
  const target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  const handle = await startSuite(target, {
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
  return { handle, target }
}
