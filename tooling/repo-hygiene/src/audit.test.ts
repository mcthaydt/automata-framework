import { describe, expect, it } from 'vitest'
import { auditVerdict } from './audit.ts'

// `pnpm audit` exits non-zero both for an advisory and for a registry it could not reach. The audit gate must
// tell them apart (AGENTS.md: diagnose product failures separately from transport failures).

const advisories = [
  '│ critical            │ Prototype Pollution in minimist                   │',
  '1 vulnerabilities found',
  'Severity: 1 critical',
].join('\n')

describe('auditVerdict', () => {
  it('reads exit 0 as clean, even when lower-severity advisories are listed', () => {
    expect(auditVerdict({ exitCode: 0, output: 'No known vulnerabilities found\n' })).toBe('clean')
    expect(auditVerdict({ exitCode: 0, output: '2 vulnerabilities found\nSeverity: 2 moderate\n' })).toBe(
      'clean',
    )
  })

  it('reads a non-zero exit with a vulnerability count as advisories', () => {
    expect(auditVerdict({ exitCode: 1, output: advisories })).toBe('advisories')
    expect(auditVerdict({ exitCode: 1, output: '1 vulnerability found\nSeverity: 1 high\n' })).toBe(
      'advisories',
    )
  })

  it('reads any other non-zero exit as an error, not as advisories', () => {
    const output = ' ERR_PNPM_AUDIT_BAD_RESPONSE  The audit endpoint responded with 503\n'
    expect(auditVerdict({ exitCode: 1, output })).toBe('error')
  })
})
