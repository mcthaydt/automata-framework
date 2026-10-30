// A suite editor for the DOM and layout tests (no shipped editor has a suite session yet, EDS.2d): one TOML file, a
// kit history of its whole text, a "Raise speed" control that adds one to the first number and writes the result
// through the ports it was opened with, and the Undo and Ask hooks. A refused write takes its own step back, as a kit
// widget's refusal state keeps the old value. `locked` holds the key paths the test locks for the session.
import { createHistory, type History } from '@mcthaydt/automata-editor-kit'
import {
  defineSuiteEditor,
  type SuiteEditor,
  type SuitePorts,
  type WorkspaceFile,
} from '@mcthaydt/automata-editor-kit/ports'
import { createRawSnippet } from 'svelte'

export interface FixtureSession {
  readonly path: string
  readonly history: History<string>
  readonly ports: SuitePorts
  readonly locked: string[]
  /** The last refusal the write reported, for the canvas. */
  refusal: string | undefined
}

const raise = (text: string): string =>
  text.replace(/= (\d+)/, (_, value: string) => `= ${Number(value) + 1}`)

async function raiseSpeed(session: FixtureSession): Promise<void> {
  session.history.apply('Raise speed', raise)
  // The suite's write path keeps the mtime guard for the files it writes, so the expectation here is not read.
  const result = await session.ports.workspace.write(session.path, session.history.state, { mtime: 0 })
  session.refusal = result.ok ? undefined : result.message
  if (!result.ok) session.history.undo()
}

export const fixtureEditor: SuiteEditor<FixtureSession> = defineSuiteEditor<FixtureSession>({
  id: 'tuner',
  label: 'Tuner',
  icon: 'sliders',
  hue: 'color/ed/tuner',
  async open(files: readonly WorkspaceFile[], ports: SuitePorts) {
    const path = files[0]?.path ?? 'content/tuning.toml'
    const text = (await ports.workspace.read(path))?.text ?? ''
    return { path, history: createHistory(text), ports, locked: [], refusal: undefined }
  },
  regions: {
    panel: createRawSnippet(() => ({ render: () => '<p>Fixture panel</p>' })),
    inspector: createRawSnippet(() => ({ render: () => '<p>Fixture inspector</p>' })),
    canvas: createRawSnippet((session: () => FixtureSession) => ({
      render: () =>
        '<div class="fixture"><pre data-testid="fixture-text"></pre><p data-testid="fixture-refusal"></p><button type="button">Raise speed</button></div>',
      setup(node) {
        const text = node.querySelector('pre')
        const refusal = node.querySelector('[data-testid="fixture-refusal"]')
        const draw = () => {
          if (text !== null) text.textContent = session().history.state
          if (refusal !== null) refusal.textContent = session().refusal ?? ''
        }
        const stop = session().history.subscribe(draw)
        draw()
        const button = node.querySelector('button')
        const click = () => void raiseSpeed(session()).then(draw)
        button?.addEventListener('click', click)
        return () => {
          stop()
          button?.removeEventListener('click', click)
        }
      },
    })),
  },
  undo: (session) => ({
    canUndo: () => session.history.canUndo,
    canRedo: () => session.history.canRedo,
    undoLabel: () => session.history.undoLabel,
    redoLabel: () => session.history.redoLabel,
    undo: () => session.history.undo(),
    redo: () => session.history.redo(),
    subscribe: (listener) => session.history.subscribe(() => listener()),
  }),
  ask: (session) => ({
    path: session.path,
    text: () => session.history.state,
    scope: () => ['MAX_MOVE_SPEED'],
    locked: () => session.locked,
    accept: (text, summary) => session.history.apply(summary, () => text),
  }),
})
