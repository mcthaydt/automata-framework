// What every narrative check reports: a level, the rule that fired, the id it fired on and a sentence of detail.
export interface Finding {
  readonly level: 'error' | 'warning'
  readonly rule: string
  readonly id: string
  readonly detail: string
}
export type Report = (level: Finding['level'], rule: string, id: string, detail: string) => void
/** A finding list and the function that adds to it. */
export function collect(): { readonly findings: Finding[]; readonly add: Report } {
  const findings: Finding[] = []
  return { findings, add: (level, rule, id, detail) => findings.push({ level, rule, id, detail }) }
}
