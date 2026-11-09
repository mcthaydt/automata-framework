import { defineSuiteEditor, type SuiteEditor } from '@automata/editor/kit/ports'
import { type ChecksPanel, createChecksPanel, type Scheduler } from './checks/checks-panel-controller'
import type { DollhouseRendererFactory } from './dollhouse/dollhouse-renderer'
import { lazyDollhouseRenderer } from './dollhouse/lazy-dollhouse-renderer'
import { canvas, inspector, panel, status, tools } from './Levels3dRegions.svelte'
import { type Levels3dOptions, type Levels3dSession, levels3dUndo, openLevels3d } from './levels-3d-session'
import type { PlanRendererFactory } from './plan/plan-renderer'
import { type Frames, NO_FRAMES } from './walk/frames'

// The 3D level editor as a suite editor (plan EDS.2d; editor suite spec §4.1, §4.7): `levels-3d` in the editor list,
// opened once per row group and kept for the app's life (EDS-D12). The host passes the clock, the Plan view's renderer
// factory (Pixi in the page, a fake in jsdom) and the scheduler the checks wait on, as the standalone app's boot does.

export interface Levels3dSuiteOptions extends Levels3dOptions {
  readonly renderer: PlanRendererFactory
  /** The 3D and Walk views' renderer; Pixi loaded when one is first shown when not given (the tests pass a fake). */
  readonly dollhouse?: DollhouseRendererFactory | undefined
  /** The page's animation frames, which Walk's eye moves on; without them it does not move by itself. */
  readonly frames?: Frames | undefined
  readonly schedule: Scheduler
}

export interface Levels3dSuiteSession {
  readonly level: Levels3dSession
  readonly renderer: PlanRendererFactory
  readonly dollhouse: DollhouseRendererFactory
  readonly frames: Frames
  /** The level's checks, run after the editing pauses; absent for a file that did not open. */
  readonly checks: ChecksPanel | undefined
}

export function createLevels3d(options: Levels3dSuiteOptions): SuiteEditor<Levels3dSuiteSession> {
  const dollhouse = options.dollhouse ?? lazyDollhouseRenderer()
  const frames = options.frames ?? NO_FRAMES
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
      return { level, renderer: options.renderer, dollhouse, frames, checks }
    },
    regions: { panel, canvas, inspector, status, tools },
    undo: (session) => levels3dUndo(session.level),
  })
}
