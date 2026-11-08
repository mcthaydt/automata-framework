// The 3D editor's suite entry (package export `./suite`, plan EDS.2d): the Levels 3D suite editor and its session.
export type {
  Levels3dOptions,
  Levels3dSession,
  Levels3dState,
} from '../../features/levels-3d/levels-3d-session'

import type { PlanRendererFactory } from '../../features/levels-3d/plan/plan-renderer'

export {
  createLevels3d,
  type Levels3dSuiteOptions,
  type Levels3dSuiteSession,
} from '../../features/levels-3d/levels-3d-suite-editor'
export { lazyPlanRenderer } from '../../features/levels-3d/plan/lazy-renderer'
export type { PlanRendererFactory }

/** The Plan view's Pixi renderer for a page, loaded on first use (what the standalone app's `main.ts` passes). */
export const loadPlanRenderer = (): Promise<{ readonly createPlanRenderer: PlanRendererFactory }> =>
  import('../../features/levels-3d/plan/plan-renderer')
