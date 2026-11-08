import { type Check, KIND, ruleVariants, type Variant } from './match'
import type { PatternCell, Rule, RuleGroup } from './rule.schema'

// What can be wrong with a set of auto-tile rules. This returns data; the Checks list turns it into diagnostics with paths and fixes. Rules that are off (inactive, or in an inactive group) are skipped:
// they are off on purpose.

export interface RuleIssue {
  readonly code: 'valueUnknown' | 'neverFires' | 'tileOutOfRange' | 'shadowed'
  readonly severity: 'error' | 'warning' | 'info'
  readonly group: string
  readonly rule: string
  readonly message: string
}

export interface RuleContext {
  /** The values the source IntGrid layer defines. */
  readonly values: ReadonlySet<number>
  /** How many tiles the layer's tileset has; `undefined` when that is not known (no image yet), which skips the range check. */
  readonly tileCount: number | undefined
}

/** The IntGrid values a pattern names with `is` or `not`, other than 0, and the numeric `outside`, in the order they occur. */
function valuesNamedBy(rule: Rule): number[] {
  const named: number[] = []
  const add = (n: number): void => {
    if (n !== 0 && !named.includes(n)) named.push(n)
  }
  for (const cell of rule.pattern as readonly PatternCell[]) {
    if (typeof cell === 'object') add('is' in cell ? cell.is : cell.not)
  }
  if (rule.outside !== 'same') add(rule.outside)
  return named
}

/** Does every value that satisfies `narrow` also satisfy `wide`? Values are 0 (empty) or 1 to 255. */
function implies(narrow: Check, wide: Check): boolean {
  switch (wide.kind) {
    case KIND.empty:
      return narrow.kind === KIND.empty
    case KIND.filled:
      return narrow.kind === KIND.filled || narrow.kind === KIND.is
    case KIND.is:
      return narrow.kind === KIND.is && narrow.value === wide.value
    default:
      // NOT n: anything but n, and 0 is not n.
      return (
        (narrow.kind === KIND.not && narrow.value === wide.value) ||
        (narrow.kind === KIND.is && narrow.value !== wide.value) ||
        narrow.kind === KIND.empty
      )
  }
}

/** Every cell `early` reads is read by `late` too, with a condition at least as narrow, so `late` matching means `early` matches. */
function covers(early: Variant, late: Variant): boolean {
  return early.checks.every((wide) => {
    const narrow = late.checks.find((check) => check.dx === wide.dx && check.dy === wide.dy)
    return narrow !== undefined && implies(narrow, wide)
  })
}

interface Listed {
  readonly group: RuleGroup
  readonly rule: Rule
}

/** Whether a rule can ever draw: it is on, has a tile, and its chance is above 0. */
const canDraw = (rule: Rule): boolean => rule.tiles.length > 0 && rule.chance > 0

/** An earlier rule that, whenever the later one would match, has already matched and ended the cell. */
function preemptedBy(before: readonly Listed[], rule: Rule): Rule | undefined {
  const lateVariants = ruleVariants(rule)
  return before.find(({ rule: early }) => {
    if (!early.breakOnMatch || early.chance < 1 || early.tiles.length === 0) return false
    if (early.flipX || early.flipY || early.outside !== rule.outside) return false
    const [plain] = ruleVariants(early)
    return plain !== undefined && lateVariants.every((variant) => covers(plain, variant))
  })?.rule
}

export function ruleIssues(groups: readonly RuleGroup[], context: RuleContext): RuleIssue[] {
  const issues: RuleIssue[] = []
  const seen: Listed[] = []
  for (const group of groups) {
    if (!group.active) continue
    for (const rule of group.rules) {
      if (!rule.active) continue
      const report = (code: RuleIssue['code'], severity: RuleIssue['severity'], message: string): void => {
        issues.push({ code, severity, group: group.id, rule: rule.id, message })
      }
      for (const value of valuesNamedBy(rule)) {
        if (!context.values.has(value))
          report(
            'valueUnknown',
            'warning',
            `Rule "${rule.id}" names the value ${value}, which the source layer does not define.`,
          )
      }
      if (rule.chance <= 0)
        report('neverFires', 'warning', `Rule "${rule.id}" has chance 0, so it never draws anything.`)
      else if (rule.tiles.length === 0)
        report('neverFires', 'warning', `Rule "${rule.id}" has no tile to draw.`)
      if (context.tileCount !== undefined) {
        const beyond = rule.tiles.filter((tile) => tile >= (context.tileCount as number))
        if (beyond.length > 0)
          report(
            'tileOutOfRange',
            'error',
            `Rule "${rule.id}" draws tile ${beyond.join(', ')}, beyond the tileset's ${context.tileCount} tiles.`,
          )
      }
      if (canDraw(rule)) {
        const by = preemptedBy(seen, rule)
        if (by)
          report(
            'shadowed',
            'info',
            `Rule "${rule.id}" never applies: "${by.id}" matches wherever it does and ends the cell first.`,
          )
        seen.push({ group, rule })
      }
    }
  }
  return issues
}
