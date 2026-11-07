// The clinic fixture: the adventure source's clinic map as `sector-map` content, and the source's own resolution of it
// (both written once by scripts/convert-adventure-map.ts).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { SectorMap } from '../sim/sector-map.schema'

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')

export const clinicMap = (): SectorMap => parse(fixture('clinic.sector-map.toml')) as unknown as SectorMap

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
