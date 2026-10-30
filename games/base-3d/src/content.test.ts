import { join } from 'node:path'
import { compileContent, formatDiagnostic } from '@mcthaydt/automata-content'
import { type FigureClipDef, figuresExtension } from '@mcthaydt/automata-figures'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { ACTION_TICKS, TICK_HZ } from './constants.ts'

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
  it('compiles Wick, the target and their libraries', async () => {
    const data = await compileFigures()
    expect(Object.keys(data.figure ?? {}).sort()).toEqual(['target', 'wick'])
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
