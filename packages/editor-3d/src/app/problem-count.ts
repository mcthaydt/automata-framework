// How many problems a run found, by severity: what the checks pill shows and what decides whether an Ask proposal can
// be accepted. A passing check has no problems, so it counts for nothing whatever its severity.
import type { CheckResult } from '../checks/check'

export const problemCount = (results: readonly CheckResult[], severity: CheckResult['severity']): number =>
  results.reduce((sum, each) => (each.severity === severity ? sum + each.problems.length : sum), 0)
