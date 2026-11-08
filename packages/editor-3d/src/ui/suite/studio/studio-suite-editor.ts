import { defineSuiteEditor, type SuiteEditor } from '@mcthaydt/automata-editor/kit/ports'
import type { StageRendererFactory } from './stage/stage-renderer'
import { createStudioController, type StudioController } from './studio-controller'
import type { Frames } from './ui/StudioCanvas.svelte'
import { canvas, dock, inspector, panel } from './ui/StudioRegions.svelte'

// The Studio as a suite editor (EDS.9; editor suite spec §4.1, §6.2, EDS-D12): `studio` in the editor list, opened once
// and kept for the app's life. The host passes the stage's renderer factory (Pixi in the page, a stand-in in jsdom), the
// frame clock the clip plays on, and the stage's background colour.

export interface StudioSuiteOptions {
  readonly stage: StageRendererFactory
  readonly frames: Frames
  /** The stage's clear colour. */
  readonly background?: number
}

export interface StudioSuiteSession {
  readonly controller: StudioController
  readonly stage: StageRendererFactory
  readonly frames: Frames
  readonly background: number
}

export function createStudio(options: StudioSuiteOptions): SuiteEditor<StudioSuiteSession> {
  return defineSuiteEditor<StudioSuiteSession>({
    id: 'studio',
    label: 'Studio',
    icon: 'person',
    hue: 'color/ed/studio',
    async open(_files, ports) {
      const controller = await createStudioController(ports)
      return {
        controller,
        stage: options.stage,
        frames: options.frames,
        background: options.background ?? 0x14161a,
      }
    },
    regions: { panel, canvas, inspector, dock },
    undo: (session) => ({
      canUndo: () => session.controller.session.history.canUndo,
      canRedo: () => session.controller.session.history.canRedo,
      undoLabel: () => session.controller.session.history.undoLabel,
      redoLabel: () => session.controller.session.history.redoLabel,
      // The shell writes the files back through its own path (and removes a file the Studio created); the history only follows.
      undo: () => session.controller.session.history.undo(),
      redo: () => session.controller.session.history.redo(),
      subscribe: (listener) => session.controller.session.history.subscribe(() => listener()),
    }),
  })
}
