// The clinic fixture: the original game's clinic as an `af-sector/2` level, and the original's own resolution of it
// (both converted once from the original).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type AfSector2, readLevel } from '@automata/3d/level'

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')

/** The clinic level, read by `readLevel` as a game reads its own. */
export const clinicMap = (): AfSector2 => readLevel(JSON.parse(fixture('clinic.af-sector.json'))).level

interface Point {
  readonly x: number
  readonly z: number
}
export interface ResolvedFixture {
  readonly sourceCommit: string
  readonly sectors: readonly {
    readonly id: string
    readonly points: readonly (readonly Point[])[]
    readonly loops: readonly (readonly {
      readonly loop: number
      readonly index: number
      readonly a: Point
      readonly b: Point
      readonly length: number
      readonly next: string | null
      readonly cut: string
      readonly thick: number
      readonly u0: number
    }[])[]
  }[]
  readonly masses: readonly unknown[]
  readonly colliders: readonly { sector: string; loop: number; index: number; y0: number; y1: number }[]
}

export const clinicResolved = (): ResolvedFixture => JSON.parse(fixture('clinic.resolved.json'))
