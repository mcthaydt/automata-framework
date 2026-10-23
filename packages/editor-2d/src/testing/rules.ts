import type { PatternCell, Rule, RuleGroup } from '../tiles/autotile/rule.schema'

// A short way to write rules in tests. A pattern is rows of one character per cell: `?` any, `.` empty, `#` filled,
// `1` to `9` is that value, `a` to `i` is not 1 to 9.

function patternCell(ch: string): PatternCell {
  if (ch === '?') return 'any'
  if (ch === '.') return 'empty'
  if (ch === '#') return 'filled'
  if (ch >= '1' && ch <= '9') return { is: Number(ch) }
  if (ch >= 'a' && ch <= 'i') return { not: ch.charCodeAt(0) - 96 }
  throw new Error(`no pattern cell is written "${ch}"`)
}

export function makeRule(
  id: string,
  rows: readonly string[],
  options: Partial<Omit<Rule, 'id' | 'size' | 'pattern'>> = {},
): Rule {
  const size = rows.length
  if (size !== 1 && size !== 3 && size !== 5) throw new Error(`a pattern has 1, 3 or 5 rows, not ${size}`)
  return {
    id,
    active: true,
    size,
    pattern: rows.flatMap((row) => [...row].map(patternCell)),
    tiles: [0],
    chance: 1,
    flipX: false,
    flipY: false,
    breakOnMatch: false,
    outside: 0,
    ...options,
  }
}

export function makeGroup(id: string, rules: readonly Rule[], active = true): RuleGroup {
  return { id, label: id, active, rules }
}
