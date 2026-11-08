import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { controlsFixtureFiles } from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner's Controls section in the suite's shell with the production CSS: every control is a full-size target inside the
// settings' own scroll region, the page never scrolls, and the "Press a key" wait keeps Cancel reachable.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []\n[[file]]\nglob = "content/controls.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

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
  // After the viewport, so the pointer-dependent target sizes are those of this run.
  const targets = editorTargets()
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts({ ...controlsFixtureFiles(), [EDITOR_LIST_PATH]: LIST }),
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === 'Tuner',
  )
  tab?.click()
  await expect.poll(() => document.querySelector('[data-testid="tuner-controls"]')).not.toBeNull()
  await settleLayout()
  return conditions
}

function reveal(control: HTMLElement): void {
  const region = control.closest<HTMLElement>('[data-scroll-region]')
  if (region === null) return
  const box = control.getBoundingClientRect()
  const view = region.getBoundingClientRect()
  region.scrollTop += Math.max(0, box.bottom - view.bottom) - Math.max(0, view.top - box.top)
}

describe.each(SIZES)('Tuner controls at $name ($width x $height)', (size) => {
  test('every control is a full-size target in the settings region, and the page never scrolls', async () => {
    const conditions = await open(size)
    const section = document.querySelector('[data-testid="tuner-controls"]') as HTMLElement
    expect(section.closest('[data-scroll-region]')).not.toBeNull()
    const controls = [...section.querySelectorAll<HTMLElement>('button, input[type="text"]')]
    expect(controls.length).toBeGreaterThan(5)
    for (const control of controls) {
      reveal(control)
      await arrived()
      expect(
        checkLayout(conditions, [control]),
        control.getAttribute('aria-label') ?? control.textContent ?? '',
      ).toEqual([])
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
    await page.screenshot({ path: `.vitest/shots/tuner-controls-${size.name}.png` })
  })

  test('waiting for a key shows Cancel as a full-size target, and Cancel ends it', async () => {
    const conditions = await open(size)
    const add = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-testid="tuner-controls"] button'),
    ].find((button) => button.textContent?.trim() === 'Add key') as HTMLButtonElement
    reveal(add)
    add.click()
    await expect.poll(() => document.body.textContent).toContain('Press a key on your keyboard.')
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-testid="tuner-controls"] button'),
    ].find((button) => button.textContent?.trim() === 'Cancel') as HTMLButtonElement
    reveal(cancel)
    await arrived()
    expect(checkLayout(conditions, [cancel])).toEqual([])
    cancel.click()
    await expect.poll(() => document.body.textContent).not.toContain('Press a key on your keyboard.')
  })
})
