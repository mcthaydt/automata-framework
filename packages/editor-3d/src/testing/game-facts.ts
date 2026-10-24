// What The Last Light's own code answers about the three lists a level's game holds (`game-facts.golden.json`): the
// materials its renderer has, the lamp archetypes and tone it allows, and what its room-visibility validator throws.
// `record-game-facts.mjs` runs the game's `readLevelOptions`, `lampIssues`, `colourDistance` and `validateRoomPolicy` over
// the cases of `game-fact-cases.json`; the tests of the ports compare against it and take the lists from it.
import { readFileSync } from 'node:fs'
import type { BlockoutLamp } from '../format/blockout.schema'
import { loadGolden } from './fixtures'

/** One lamp archetype as the game's `readLevelOptions` reads it: sRGB 0 to 1, and the range band in metres. */
export interface GameLampKind {
  readonly color: readonly [number, number, number]
  readonly range: readonly [number, number]
  readonly peak?: number
}

export interface GameOptions {
  readonly materials: readonly string[] | null
  readonly lampKinds: Readonly<Record<string, GameLampKind>> | null
  readonly tone: number | null
}

export interface LampCase {
  readonly id: string
  readonly lamp: BlockoutLamp
}

/** A room policy and what it is checked against: the sectors, the camera zones and the number of masses. */
export interface PolicyCase {
  readonly id: string
  readonly policy: unknown
  readonly sectors: readonly string[]
  readonly zones: readonly string[]
  readonly masses: number
  readonly note?: string
}

export interface GameFactCases {
  readonly lamps: readonly LampCase[]
  readonly policies: readonly PolicyCase[]
}

export interface GameFacts {
  readonly options: GameOptions
  /** What the game's own `readLevelOptions` answered for the materials: `null` at 92e6704 (see the recorder). */
  readonly reader: { readonly materials: readonly string[] | null }
  /** `lampIssues` for each lamp, and `colourDistance` from its archetype when its kind is one. */
  readonly lamps: readonly {
    readonly id: string
    readonly issues: readonly string[]
    readonly distance: number | null
  }[]
  /** The message `validateRoomPolicy` threw, or `null` when it accepted the policy. */
  readonly policies: readonly { readonly id: string; readonly thrown: string | null }[]
}

export function loadGameFactCases(): GameFactCases {
  return JSON.parse(
    readFileSync(new URL('./fixtures/game-fact-cases.json', import.meta.url), 'utf8'),
  ) as GameFactCases
}

export function loadGameFacts(): GameFacts {
  return JSON.parse(loadGolden('game-facts')) as GameFacts
}
