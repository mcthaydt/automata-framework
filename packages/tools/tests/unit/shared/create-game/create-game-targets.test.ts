import { describe, expect, it } from 'vitest'
import { DIST_TARGETS, parseTargets } from '#src/shared/create-game/create-game-targets.ts'

// The targets `create-game` writes a game for (DIST spec §5.3, DIST-D9): the four peers, all by default.

describe('parseTargets', () => {
  it('reads a comma-separated list in the order given', () => {
    expect(parseTargets('web,tauri')).toEqual({ ok: true, targets: ['web', 'tauri'] })
    expect(parseTargets(' itch , ruken ')).toEqual({ ok: true, targets: ['itch', 'ruken'] })
  })

  it('defaults to all four peers', () => {
    expect(DIST_TARGETS).toEqual(['web', 'itch', 'ruken', 'tauri'])
    expect(parseTargets(undefined)).toEqual({ ok: true, targets: DIST_TARGETS })
  })

  it.each([
    ['', 'no target'],
    ['steam', 'unknown target "steam"'],
    ['web,web', 'target "web" given twice'],
  ])('refuses %j, naming the problem and the four allowed', (value, problem) => {
    const result = parseTargets(value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain(problem)
      expect(result.message).toContain('web, itch, ruken, tauri')
    }
  })
})
