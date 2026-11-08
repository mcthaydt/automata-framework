import type { Grid } from '../../model/grid'
import { hashCell, hashText, SALT } from '../hash'
import type { PatternCell, Rule, RuleGroup } from './rule.schema'

// Evaluating auto-tile rules for one cell (2D editor spec §5.6). The rules are compiled once into flat lists of the
// cells each rule really reads, so deciding a cell is a few comparisons and the 'any' cells of a pattern cost nothing.

/** One tile drawn at a cell; a cell holds a stack of them in rule order. */
export interface AutoTile {
  readonly tile: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** What a pattern cell asks of the value read: `EMPTY` is 0, `FILLED` is not 0, `IS` and `NOT` compare with `value`. */
export const KIND = { empty: 0, filled: 1, is: 2, not: 3 } as const
const { empty: EMPTY, filled: FILLED, is: IS, not: NOT } = KIND

/** One cell of a pattern: where to read it from the cell being decided, and what it must hold. */
export interface Check {
  readonly dx: number
  readonly dy: number
  readonly kind: number
  readonly value: number
}

/** The pattern as seen from one mirroring: the centre check, if any, comes first so most rules fail fast. */
export interface Variant {
  readonly flipX: boolean
  readonly flipY: boolean
  readonly checks: readonly Check[]
}

interface CompiledRule {
  /** `hashText` of the rule id: the part of the hash that makes two rules roll independently. */
  readonly key: number
  readonly tiles: readonly number[]
  /** A roll below this applies the rule; `undefined` means chance 1, which needs no roll. */
  readonly threshold: number | undefined
  readonly breakOnMatch: boolean
  readonly outsideSame: boolean
  readonly outsideValue: number
  readonly variants: readonly Variant[]
}

export interface CompiledRules {
  /** How far from a cell the rules read: a change to a source cell can alter the tiles within this many cells. */
  readonly radius: number
  readonly rules: readonly CompiledRule[]
}

function checkOf(cell: PatternCell, dx: number, dy: number): Check | undefined {
  if (cell === 'any') return undefined
  if (cell === 'empty') return { dx, dy, kind: EMPTY, value: 0 }
  if (cell === 'filled') return { dx, dy, kind: FILLED, value: 0 }
  // `is 0` and `not 0` are `empty` and `filled` spelled differently; the file schema refuses them, a hand-built rule may not.
  if ('is' in cell)
    return cell.is === 0 ? { dx, dy, kind: EMPTY, value: 0 } : { dx, dy, kind: IS, value: cell.is }
  return cell.not === 0 ? { dx, dy, kind: FILLED, value: 0 } : { dx, dy, kind: NOT, value: cell.not }
}

function variantOf(
  checks: readonly Check[],
  flipX: boolean,
  flipY: boolean,
): { variant: Variant; signature: string } {
  const mirrored = checks.map((check) => ({
    ...check,
    dx: flipX ? -check.dx : check.dx,
    dy: flipY ? -check.dy : check.dy,
  }))
  const signature = mirrored
    .map((check) => `${check.dx},${check.dy},${check.kind},${check.value}`)
    .sort()
    .join(';')
  return { variant: { flipX, flipY, checks: mirrored }, signature }
}

/**
 * The ways a rule can match: the plain pattern, then (for the flips it enables) the pattern mirrored left-right,
 * up-down, and both, in the order they are tried. Only the cells that ask something are listed, centre first. A
 * mirroring that reads the same cells as an earlier one is left out: the earlier one always wins, so it adds nothing.
 */
export function ruleVariants(rule: Rule): Variant[] {
  const half = rule.size >> 1
  const checks: Check[] = []
  rule.pattern.forEach((cell, index) => {
    const check = checkOf(cell, (index % rule.size) - half, Math.floor(index / rule.size) - half)
    if (check) checks.push(check)
  })
  // The centre first: it is the cheapest way to reject most cells.
  checks.sort((a, b) => Number(b.dx === 0 && b.dy === 0) - Number(a.dx === 0 && a.dy === 0))

  const wanted: [boolean, boolean][] = [[false, false]]
  if (rule.flipX) wanted.push([true, false])
  if (rule.flipY) wanted.push([false, true])
  if (rule.flipX && rule.flipY) wanted.push([true, true])
  const variants: Variant[] = []
  const seen = new Set<string>()
  for (const [flipX, flipY] of wanted) {
    const { variant, signature } = variantOf(checks, flipX, flipY)
    if (seen.has(signature)) continue
    seen.add(signature)
    variants.push(variant)
  }
  return variants
}

/** The active rules of the active groups, in evaluation order, compiled; rules that can never draw are left out. */
export function compileRules(groups: readonly RuleGroup[]): CompiledRules {
  const rules: CompiledRule[] = []
  let radius = 0
  for (const group of groups) {
    if (!group.active) continue
    for (const rule of group.rules) {
      if (!rule.active || rule.tiles.length === 0 || rule.chance <= 0) continue
      const variants = ruleVariants(rule)
      // Mirroring keeps the distances, so the plain pattern (always first) gives the reach.
      for (const check of variants[0]?.checks ?? [])
        radius = Math.max(radius, Math.abs(check.dx), Math.abs(check.dy))
      rules.push({
        key: hashText(rule.id),
        tiles: rule.tiles,
        threshold: rule.chance >= 1 ? undefined : Math.floor(rule.chance * 4294967296),
        breakOnMatch: rule.breakOnMatch,
        outsideSame: rule.outside === 'same',
        outsideValue: rule.outside === 'same' ? 0 : rule.outside,
        variants,
      })
    }
  }
  return { radius, rules }
}

function matches(
  source: Grid,
  rule: CompiledRule,
  variant: Variant,
  x: number,
  y: number,
  centre: number,
): boolean {
  const { cols, rows } = source
  for (const check of variant.checks) {
    const sx = x + check.dx
    const sy = y + check.dy
    const inside = sx >= 0 && sy >= 0 && sx < cols && sy < rows
    const value = inside ? source.get(sx, sy) : rule.outsideSame ? centre : rule.outsideValue
    switch (check.kind) {
      case EMPTY:
        if (value !== 0) return false
        break
      case FILLED:
        if (value === 0) return false
        break
      case IS:
        if (value !== check.value) return false
        break
      default:
        if (value === check.value) return false
    }
  }
  return true
}

/**
 * The tiles of the cell at (x, y), in rule order. Groups run in order and so do the rules inside them. A rule that
 * matches (the first of its mirrorings that does) rolls its chance and, if it passes, adds a tile; a rule whose roll
 * fails did not match, so it does not break. A cell outside the level has no tiles.
 */
export function evaluateCell(
  source: Grid,
  compiled: CompiledRules,
  seed: number,
  x: number,
  y: number,
): AutoTile[] {
  const stack: AutoTile[] = []
  if (x < 0 || y < 0 || x >= source.cols || y >= source.rows) return stack
  const centre = source.get(x, y)
  for (const rule of compiled.rules) {
    const variant = rule.variants.find((candidate) => matches(source, rule, candidate, x, y, centre))
    if (!variant) continue
    if (rule.threshold !== undefined && hashCell(seed, rule.key, x, y, SALT.chance) >= rule.threshold)
      continue
    const pick =
      rule.tiles.length === 1 ? 0 : hashCell(seed, rule.key, x, y, SALT.variant) % rule.tiles.length
    stack.push({ tile: rule.tiles[pick] as number, flipX: variant.flipX, flipY: variant.flipY })
    if (rule.breakOnMatch) break
  }
  return stack
}
