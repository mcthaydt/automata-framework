import { defineSuiteEditor, type SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { type ChecksPanel, createChecksPanel, type Scheduler } from '../../app/checks-panel-controller'
import {
  type Levels3dOptions,
  type Levels3dSession,
  levels3dAsk,
  levels3dUndo,
  openLevels3d,
} from '../../app/levels-3d-session'
import type { PlanRendererFactory } from '../plan/plan-renderer'
import { canvas, inspector, panel, status } from './Levels3dRegions.svelte'

// The 3D level editor as a suite editor (plan EDS.2d; editor suite spec §4.1, §4.7): `levels-3d` in the editor list,
// opened once per row group and kept for the app's life (EDS-D12). The host passes the clock, the Plan view's renderer
// factory (Pixi in the page, a fake in jsdom) and the scheduler the checks wait on, as the standalone app's boot does.

export interface Levels3dSuiteOptions extends Levels3dOptions {
  readonly renderer: PlanRendererFactory
  readonly schedule: Scheduler
}

export interface Levels3dSuiteSession {
  readonly level: Levels3dSession
  readonly renderer: PlanRendererFactory
  /** The level's checks, run after the editing pauses; absent for a file that did not open. */
  readonly checks: ChecksPanel | undefined
}

export function createLevels3d(options: Levels3dSuiteOptions): SuiteEditor<Levels3dSuiteSession> {
  return defineSuiteEditor<Levels3dSuiteSession>({
    id: 'levels-3d',
    label: 'Levels 3D',
    icon: 'cube',
    hue: 'color/ed/levels',
    async open(files, ports) {
      const level = await openLevels3d(files, ports, options)
      const checks =
        level.state.kind === 'open'
          ? createChecksPanel(level.state.editor, { schedule: options.schedule })
          : undefined
      return { level, renderer: options.renderer, checks }
    },
    regions: { panel, canvas, inspector, status },
    undo: (session) => levels3dUndo(session.level),
    ask: (session) => levels3dAsk(session.level),
  })
}
