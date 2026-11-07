// The result of `automata check` and its two printed forms (DX spec §3.6). The JSON is what the plugin hooks
// feed back to the agent, so its shape is exact: `{ ok, steps: [{ name, ok, ms, findings }] }` and nothing else.

export type StepName =
  | 'boundaries'
  | 'typecheck'
  | 'test'
  | 'boards'
  | 'orientation'
  | 'inputs'
  | 'no-eval'
  | 'secrets'
  | 'data-urls'
  | 'csp'

export interface CheckFinding {
  /** Relative to the game folder; empty when a finding has no file (a tool error, a build failure). */
  readonly file: string
  /** 1-based; 0 when unknown. */
  readonly line: number
  readonly col: number
  readonly rule: string
  readonly message: string
}

export interface StepResult {
  readonly name: StepName
  readonly ok: boolean
  readonly ms: number
  readonly findings: readonly CheckFinding[]
  /**
   * The step could not run (a missing tool, a crash). Its single finding says why, with rule `tool-missing` or
   * `tool-error`. Not printed in the JSON; it decides exit code 2.
   */
  readonly toolError: boolean
}

export interface CheckReport {
  readonly ok: boolean
  readonly steps: readonly StepResult[]
}

/** A report with no steps is not a pass: nothing was checked. */
export const reportOf = (steps: readonly StepResult[]): CheckReport => ({
  ok: steps.length > 0 && steps.every((step) => step.ok),
  steps,
})

/** 0 pass, 1 findings, 2 tool error. A tool error wins over findings: the check is incomplete. */
export function exitCodeFor(report: CheckReport): 0 | 1 | 2 {
  if (report.steps.length === 0 || report.steps.some((step) => step.toolError)) return 2
  return report.ok ? 0 : 1
}

export function toJson(report: CheckReport): string {
  return JSON.stringify({
    ok: report.ok,
    steps: report.steps.map((step) => ({
      name: step.name,
      ok: step.ok,
      ms: step.ms,
      findings: step.findings.map((f) => ({
        file: f.file,
        line: f.line,
        col: f.col,
        rule: f.rule,
        message: f.message,
      })),
    })),
  })
}

const where = (f: CheckFinding): string =>
  f.file === '' ? '' : f.line > 0 ? `${f.file}:${f.line}:${f.col}` : f.file

export function formatText(report: CheckReport): string {
  const lines: string[] = []
  for (const step of report.steps) {
    lines.push(`${step.ok ? 'pass' : 'FAIL'}  ${step.name} (${step.ms} ms)`)
    for (const f of step.findings)
      lines.push(`  ${[where(f), f.rule, f.message].filter((s) => s !== '').join('  ')}`)
  }
  const count = report.steps.reduce((sum, step) => sum + (step.toolError ? 0 : step.findings.length), 0)
  const toolErrors = report.steps.filter((step) => step.toolError).length
  const summary = [`${count} finding${count === 1 ? '' : 's'}`]
  if (toolErrors > 0) summary.push(`${toolErrors} step${toolErrors === 1 ? '' : 's'} could not run`)
  lines.push(`automata check: ${summary.join(', ')}`)
  return `${lines.join('\n')}\n`
}
