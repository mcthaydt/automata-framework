import { EDITOR_LIST_PATH } from '@mcthaydt/automata-editor/editor-list'
import type { SuiteEditor } from '@mcthaydt/automata-editor/kit/ports'
import { createSuite, type SuiteHandle, samplePorts, startSuite } from '@mcthaydt/automata-editor/suite'
import { screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageRenderer } from './stage/stage-renderer'
import { createStudio } from './studio-suite-editor'
import { studioFixtureFiles } from './testing/studio-fixtures'

// The Studio in the suite shell and the shell's write protocol (core/write-path.ts): the Studio applies its history step
// first, so the write the shell routes is recorded under the step's label ("Undo Set height of wick", not "Undo Edit"),
// and Undo from the top bar has the shell write the file back once: the Studio's hook only steps its history.

const LIST = `format = "af-editors/1"
[[file]]
glob = "content/figure*/**/*.toml"
editor = "studio"
modes = ["edit"]
gates = []
checks = []
`
const WICK = 'content/figures/wick.toml'

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
beforeEach(() => {
  // A window wide enough for the kit shell's wide layout (1180 px and up), where the Studio's inspector is in view;
  // jsdom's own 1024 px window is the medium layout, where it is a closed floating card.
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        private readonly report: (entries: { contentRect: { width: number; height: number } }[]) => void,
      ) {}
      observe(): void {
        this.report([{ contentRect: { width: 800, height: 600 } }])
      }
      disconnect(): void {}
    },
  )
})
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('the Studio in the suite', () => {
  it('records its write under the step’s label, and the shell’s Undo writes the file back once', async () => {
    const target = document.body.appendChild(document.createElement('div'))
    const files: Record<string, string> = { ...studioFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
    const ports = await samplePorts(files)
    const writes: string[] = []
    const write = ports.workspace.write.bind(ports.workspace)
    ports.workspace.write = (path, text, expected) => {
      writes.push(path)
      return write(path, text, expected)
    }
    const studio = createStudio({ stage: standin, frames: { request: () => 0, cancel: () => {} } })
    started = await startSuite(target, {
      window,
      document,
      ports,
      suite: createSuite({ editors: [studio as SuiteEditor<unknown>] }),
    })
    await userEvent.click(await screen.findByRole('tab', { name: 'Studio' }))
    const slider = await screen.findByRole('slider', { name: /Height/ })
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Taller')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))

    const undo = await screen.findByRole('button', { name: /^Undo Set height of wick$/ })
    const edited = (await ports.workspace.read(WICK))?.text
    expect(edited).not.toBe(files[WICK])
    const afterEdit = writes.length

    await userEvent.click(undo)
    await screen.findByRole('button', { name: 'Undo' })
    expect((await ports.workspace.read(WICK))?.text).toBe(files[WICK])
    // The shell wrote the file back once; the Studio's hook did not write it a second time.
    expect(writes.length - afterEdit).toBe(1)
  })
})
