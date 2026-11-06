import { defineJourneys } from '@mcthaydt/playwright-preset'
import { frameBudgetRun } from './src/playwright-run.ts'

// The frame-budget probe (PRODUCT.7): `pnpm test:frame-budget` at the root. It never shares a run with the
// journeys, because a performance probe needs the GPU to itself (AGENTS.md).
// No retries: a retry would overwrite the first attempt's result file, and a probe that needs a second try is not a measurement.
export default frameBudgetRun(defineJourneys({ retries: 0 }))
