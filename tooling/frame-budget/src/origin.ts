import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { claimPort } from '../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// Where the stress example is served for the probe, and where the probe writes its results. The probe runs alone
// (its Playwright config selects nothing else), but its port is free like every journey's, so a probe never meets a
// journey server of another job.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

export const stressPort: number = claimPort('frame-budget-stress')
export const stressUrl = `http://localhost:${stressPort}/`
/** One `<project>.json` per frame-budget project; `pnpm budget:frame` reads them all. */
export const resultsDir: string = join(repoRoot, 'frame-budget-results')
