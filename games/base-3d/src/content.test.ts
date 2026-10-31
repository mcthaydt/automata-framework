import { join } from 'node:path'
import { compileContent, formatDiagnostic } from '@mcthaydt/automata-content'
import { type FigureClipDef, figuresExtension } from '@mcthaydt/automata-figures'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { ENEMY_MOVES } from './constants/enemies.ts'
import { ACTION_TICKS, HERO_MOVES, TICK_HZ } from './constants/index.ts'
import { moveClipProblems } from './views/move-clips.ts'

// base-3d's figure content (M3 spec §4.7): Wick and the target as `figure` content with their libraries, the
// pose library and the four clips, compiled with the figures extension's kinds as the page compiles them.

async function compileFigures() {
  const result = await Effect.runPromise(
    Effect.either(
      compileContent({ root: join(import.meta.dirname), schemas: figuresExtension.content ?? [] }),
    ),
  )
  if (Either.isLeft(result)) {
    const error = result.left
    throw new Error(
      error._tag === 'ContentCompileFailed'
        ? error.diagnostics.map(formatDiagnostic).join('\n')
        : error.message,
    )
  }
  return result.right.data as Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

describe('figure content', () => {
  it('compiles Wick, the target, the enemies’ placeholders and their libraries', async () => {
    const data = await compileFigures()
    expect(Object.keys(data.figure ?? {}).sort()).toEqual([
      'ash-captain',
      'ash-knight',
      'sootling',
      'target',
      'warden',
      'wick',
    ])
    expect(Object.keys(data['figure-item'] ?? {}).sort()).toEqual(expect.arrayContaining(['shield', 'sword']))
  })

  it('has the four clips: slash, point and pickup as actions as long as the sim plays them, guard as a stance', async () => {
    const clips = (await compileFigures())['figure-clip'] as Readonly<Record<string, FigureClipDef>>
    for (const move of ['slash', 'point', 'pickup'] as const) {
      expect(clips[move]?.loop).toBe('once')
      expect(Math.round((clips[move]?.length ?? 0) * TICK_HZ)).toBe(ACTION_TICKS[move])
    }
    // The slash plays over the walk: it owns only the right arm and the torso.
    expect(clips.slash?.mask).toEqual(['armR', 'torso'])
    expect(clips.guard?.loop).toBe('hold')
  })
})

describe('the moves’ clips (GAME-3D.1c part 3, G3-d)', () => {
  it('gives each of Wick’s moves its own clip, played once, as long as the move', async () => {
    const clips = (await compileFigures())['figure-clip'] as Readonly<Record<string, FigureClipDef>>
    for (const move of HERO_MOVES) {
      const clip = clips[move.clip ?? move.id]
      expect(clip?.loop, move.id).toBe('once')
      expect(Math.round((clip?.length ?? 0) * TICK_HZ), move.id).toBe(move.total)
    }
    expect(clips['slash-2']?.blend?.inMs).toBe(50)
    expect(clips.thrust?.blend?.inMs).toBe(50)
  })

  it('shows contact on every sword move’s first active frame, within a tick (G3-d)', async () => {
    const clips = (await compileFigures())['figure-clip'] as Readonly<Record<string, FigureClipDef>>
    expect(moveClipProblems(HERO_MOVES, clips)).toEqual([])
  })
})

describe('the enemies’ clips (GAME-3D.1d part 4, G3-d, G3-F7)', () => {
  // The Wisp is a mesh, not a figure (GAME3D-D10): its dive names no clip.
  const drawn = ENEMY_MOVES.filter((move) => move.clip !== undefined)

  it('gives every figure-drawn enemy move its own clip, played once, as long as the move', async () => {
    const clips = (await compileFigures())['figure-clip'] as Readonly<Record<string, FigureClipDef>>
    expect(drawn.map((move) => move.id)).toEqual(
      ENEMY_MOVES.filter((move) => move.id !== 'wisp-dive').map((move) => move.id),
    )
    for (const move of drawn) {
      const clip = clips[move.clip as string]
      expect(clip?.loop, move.id).toBe('once')
      expect(Math.round((clip?.length ?? 0) * TICK_HZ), move.id).toBe(move.total)
    }
  })

  it('shows contact on every enemy move’s first active frame, within a tick, and names no missing clip', async () => {
    const clips = (await compileFigures())['figure-clip'] as Readonly<Record<string, FigureClipDef>>
    expect(moveClipProblems(drawn, clips)).toEqual([])
  })
})
