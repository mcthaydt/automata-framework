import { isSoftwareGpu } from './budget.ts'

// What the probe does differently for the 3D look: its own page, and no measurement on a machine with no GPU.

/** Why a 3D project is skipped when the page was drawn by a CPU rasterizer. */
export const SOFTWARE_SKIP = 'Skipped: software renderer, no frame budget measured.'

/** The reason to skip a 3D project on this renderer, or `undefined` when it is a GPU and worth measuring. */
export function softwareSkip(gpu: string): string | undefined {
  return isSoftwareGpu(gpu) ? SOFTWARE_SKIP : undefined
}

/** The page a project measures, relative to the stress server's root: the 3D projects have their own. */
export function stressPageOf(project: string): string {
  return project.startsWith('frame-budget-3d-') ? 'stress/3d/index.html' : ''
}
