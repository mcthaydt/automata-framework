// Usage: node tooling/repo-hygiene/src/audit-cli.ts   (the root `pnpm audit:deps`)
//
// 1. Audits fixtures/audit, a lockfile holding minimist 1.2.5 (GHSA-xvch-5gv4-984h, critical), and requires
//    advisories: if the audit cannot see a known advisory, a clean result below proves nothing.
// 2. Audits the workspace with `pnpm audit --prod --audit-level=high` and requires a clean result.
// A registry error fails the run as an error, never as a pass.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { AUDIT_ARGS, type AuditRun, auditVerdict } from './audit.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixture = fileURLToPath(new URL('../fixtures/audit', import.meta.url))

function audit(cwd: string): AuditRun {
  const result = spawnSync('pnpm', AUDIT_ARGS, { cwd, encoding: 'utf8' })
  return { exitCode: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

const planted = audit(fixture)
if (auditVerdict(planted) !== 'advisories') {
  console.error(`audit: the fixture's known advisory was not reported (${auditVerdict(planted)}):`)
  console.error(planted.output)
  process.exit(1)
}
console.log('audit: fixture lockfile fails as it should (minimist 1.2.5, critical)')

const workspace = audit(root)
const verdict = auditVerdict(workspace)
console.log(workspace.output.trim())
if (verdict !== 'clean') {
  console.error(`audit: pnpm ${AUDIT_ARGS.join(' ')} gave ${verdict}`)
  process.exit(1)
}
console.log(`audit: pnpm ${AUDIT_ARGS.join(' ')} is clean`)
