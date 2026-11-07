import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { portsFor } from '../../../packages/tools/src/shared/ship/ports/ports-for.ts'

// Where the stress example is served for the probe, and where the probe writes its results. The probe runs alone
// (its Playwright config selects nothing else), but its port still sits clear of the journeys' offsets (the ui demo
// +100 and emberwick +300 on the preview port, tooling/examples-runner/host/ports.ts) so a probe never meets a journey server.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const ports = portsFor(repoRoot, process.env)

export const stressPort: number = Number(process.env.AF_FRAME_BUDGET_PORT ?? ports.preview + 200)
export const stressUrl = `http://localhost:${stressPort}/`
/** One `<project>.json` per frame-budget project; `pnpm budget:frame` reads them all. */
export const resultsDir: string = join(repoRoot, 'frame-budget-results')
