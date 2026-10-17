// Dependency audit (QB spec §4.1, QB.1): `pnpm audit --prod --audit-level=high` on the workspace. pnpm exits
// non-zero for an advisory at or above the level and also when the registry's audit endpoint fails, so the
// verdict reads the output to tell the two apart.

export type AuditVerdict = 'clean' | 'advisories' | 'error'

export interface AuditRun {
  readonly exitCode: number
  /** stdout and stderr together. */
  readonly output: string
}

/** The command the gate runs, in the workspace and in the fixture. */
export const AUDIT_ARGS: readonly string[] = ['audit', '--prod', '--audit-level=high']

export function auditVerdict(run: AuditRun): AuditVerdict {
  if (run.exitCode === 0) return 'clean'
  return /\b\d+ vulnerabilit(?:y|ies) found\b/.test(run.output) ? 'advisories' : 'error'
}
