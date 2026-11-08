import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { arrived, REST, SIZES } from '@automata/editor/kit/testing'
import { createSuite, type SuiteHandle, samplePorts, startSuite } from '@automata/editor/suite'
import { chooseEditor } from '@automata/editor/suite/testing/layout'
import { publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import { createStageRenderer } from '#src/features/studio/stage/stage-renderer.ts'
import { createStudio } from '#src/features/studio/studio-suite-editor.ts'
import { studioFixtureFiles } from '#src/testing/studio/studio-fixtures.ts'

// The Studio's review images (EDS.9, for the delegated visual acceptance): Look, Pose and Animate in the suite's shell
// at the iPad Pro 11" landscape with the real stage, written only with `EDS_VISUALS=1`; never compared against, never
// a golden. The mockup frames they are read against are `studio-look`, `studio-pose` and `studio-animate`.

declare module 'vitest' {
  interface ProvidedContext {
    writeVisuals: boolean
  }
}

const OUT = '../../../../../../docs/evidence/owner-visual/2026-10-31-eds-9'
const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/figure*/**/*.toml"\neditor = "studio"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
})

async function open(): Promise<void> {
  const size = SIZES.find((each) => each.name === 'ipad-pro-11-landscape')
  if (size === undefined) throw new Error('no size')
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, REST)
  const ports = await samplePorts({ [EDITOR_LIST_PATH]: LIST, ...studioFixtureFiles() })
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
  await chooseEditor('Characters')
  await expect
    .poll(() => document.querySelector('[data-testid="studio-stage"][data-status="ready"]'))
    .not.toBeNull()
  await arrived()
}

const press = async (name: string): Promise<void> => {
  ;[...document.querySelectorAll<HTMLElement>('button, [role="radio"]')]
    .find((each) => (each.getAttribute('aria-label') ?? each.textContent?.trim()) === name)
    ?.click()
  await arrived()
}

async function shoot(file: string): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await page.screenshot({ path: `${OUT}/${file}` })
}

describe.runIf(inject('writeVisuals'))('the Studio’s images for review', () => {
  it('Look, Pose and Animate at ipad-pro-11-landscape', async () => {
    await open()
    await shoot('studio-look-ipad-pro-11-landscape.png')
    await press('Pose')
    await press('handR handle')
    await shoot('studio-pose-ipad-pro-11-landscape.png')
    await press('Animate')
    await press('roll')
    await shoot('studio-animate-ipad-pro-11-landscape.png')
  })
})
