import { get } from 'svelte/store'
import { defineSuiteEditor, type SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'
import { TUNING_PATH } from './tuner-content'
import { createTunerController, type TunerController } from './tuner-controller'
import { canvas, inspector, panel } from './ui/TunerRegions.svelte'

// The Tuner as a suite editor: `tuner` in the editor list, opened
// once and kept for the app's life. Its Ask target is `content/tuning.toml`; the locks the person set are what the shell's
// Ask refuses a proposal to change, and an accepted proposal is one undo step.

export interface TunerSuiteSession {
  readonly controller: TunerController
}

export function createTuner(): SuiteEditor<TunerSuiteSession> {
  return defineSuiteEditor<TunerSuiteSession>({
    id: 'tuner',
    label: 'Tuner',
    icon: 'sliders',
    hue: 'color/ed/tuner',
    async open(_files, ports) {
      return { controller: await createTunerController(ports) }
    },
    regions: { panel, canvas, inspector },
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
