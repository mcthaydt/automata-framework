import { relative } from 'node:path'
import { z } from 'zod'
import type { CheckFinding } from './check-report.ts'

// Turns each tool's own output into findings. The tools run with the game folder as their working folder, so
// the paths they print are already relative to it (vitest's JSON holds absolute paths, made relative here).

/** `src/sim/a.ts:3:7  rule  message` (tooling/check-boundaries/src/cli.ts). The summary line is skipped. */
export function parseBoundaries(stdout: string): CheckFinding[] {
  const findings: CheckFinding[] = []
  for (const line of stdout.split('\n')) {
    const match = /^(.+):(\d+):(\d+) {2}(\S+) {2}(.*)$/.exec(line)
    if (match === null) continue
    const [, file = '', row = '0', col = '0', rule = '', message = ''] = match
    findings.push({ file, line: Number(row), col: Number(col), rule, message })
  }
  return findings
}

/** `file(line,col): error TSnnnn: message` and file-less `error TSnnnn: message` (`--pretty false`). */
export function parseTsc(stdout: string): CheckFinding[] {
  const findings: CheckFinding[] = []
  let last: { -readonly [K in keyof CheckFinding]: CheckFinding[K] } | undefined
  for (const line of stdout.split('\n')) {
    const withFile = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
    const withoutFile = withFile === null ? /^error (TS\d+): (.*)$/.exec(line) : null
    if (withFile !== null) {
      const [, file = '', row = '0', col = '0', rule = '', message = ''] = withFile
      last = { file, line: Number(row), col: Number(col), rule, message }
      findings.push(last)
    } else if (withoutFile !== null) {
      const [, rule = '', message = ''] = withoutFile
      last = { file: '', line: 0, col: 0, rule, message }
      findings.push(last)
    } else if (last !== undefined && line.startsWith(' ')) {
      last.message += `\n${line}` // tsc indents a message's continuation lines
    }
  }
  return findings
}

const VitestReport = z.object({
  testResults: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      message: z.string().optional(),
      assertionResults: z.array(
        z.object({
          fullName: z.string(),
          status: z.string(),
          location: z.object({ line: z.number(), column: z.number() }).nullish(),
          failureMessages: z.array(z.string()).nullish(),
        }),
      ),
    }),
  ),
})

/** Vitest's `--reporter=json` report: each failed test, and each file that failed outside a test (an import). */
export function parseVitestJson(json: string, gameDir: string): CheckFinding[] {
  const report = VitestReport.parse(JSON.parse(json))
  const findings: CheckFinding[] = []
  for (const result of report.testResults) {
    const file = relative(gameDir, result.name).split('\\').join('/')
    const failedTests = result.assertionResults.filter((test) => test.status === 'failed')
    for (const test of failedTests) {
      const firstLine = (test.failureMessages?.[0] ?? '').split('\n')[0] ?? ''
      findings.push({
        file,
        line: test.location?.line ?? 0,
        col: test.location?.column ?? 0,
        rule: 'test',
        message: firstLine === '' ? test.fullName : `${test.fullName}: ${firstLine}`,
      })
    }
    if (result.status === 'failed' && failedTests.length === 0) {
      findings.push({ file, line: 0, col: 0, rule: 'test-file', message: result.message || 'failed' })
    }
  }
  return findings
}
