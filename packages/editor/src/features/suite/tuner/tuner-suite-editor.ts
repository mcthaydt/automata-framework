import { get } from 'svelte/store'
import { defineSuiteEditor, type SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'
import { TUNING_PATH } from './tuner-content'
import { createTunerController, type TunerController } from './tuner-controller'
import { canvas } from './ui/TunerRegions.svelte'

// The Tuner as a suite editor: `tuner` in the editor list, opened
// once and kept for the app's life. Its canvas is a split view: the game's dev page running beside the settings, so
// each change shows in the game as it is written (the content plugin restarts the game on the new tuning). Its Ask target is `content/tuning.toml`; the locks the person set are what the shell's
// Ask refuses a proposal to change, and an accepted proposal is one undo step.

export interface TunerSuiteSession {
  readonly controller: TunerController
  /** The game's dev page the canvas shows beside the settings, or none (the sample game has no game to run). */
  readonly gameUrl: string | undefined
}

export interface TunerOptions {
  /** The game's dev page, from `automata editor`'s ping (`--game-url`). */
  readonly gameUrl?: string | undefined
}

export function createTuner(options: TunerOptions = {}): SuiteEditor<TunerSuiteSession> {
  return defineSuiteEditor<TunerSuiteSession>({
    id: 'tuner',
    label: 'Tuner',
    icon: 'sliders',
    hue: 'color/ed/tuner',
    async open(_files, ports) {
      return { controller: await createTunerController(ports), gameUrl: options.gameUrl }
    },
    regions: { canvas },
    undo: (session) => ({
      canUndo: () => session.controller.session.history.canUndo,
      canRedo: () => session.controller.session.history.canRedo,
      undoLabel: () => session.controller.session.history.undoLabel,
      redoLabel: () => session.controller.session.history.redoLabel,
      // The shell writes the file back through its own path; the editor's history only follows.
      undo: () => session.controller.session.history.undo(),
      redo: () => session.controller.session.history.redo(),
      subscribe: (listener) => session.controller.session.history.subscribe(() => listener()),
    }),
    ask: (session) => ({
      path: TUNING_PATH,
      text: () => session.controller.session.history.state.text ?? '',
      scope: () => {
        const chosen = get(session.controller.selected)
        return chosen === undefined ? [] : [chosen]
      },
      locked: () => session.controller.session.locked(),
      accept: (text, summary) => void session.controller.session.accept(text, summary),
    }),
  })
}
