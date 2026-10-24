import { readFileSync } from 'node:fs'

// The numbers FloorFifty's own code computes (`testing/make-goldens.mjs`, see PROVENANCE.md). The tests compare the
// editor's ports with them exactly.

export interface CourseGolden {
  readonly name: string
  readonly seed: number
  /** The overrides given to the game's `resolveTuning`. */
  readonly tuning: Readonly<Record<string, number>>
  readonly budget: number
  readonly floorCount: number
  readonly bounds: { readonly left: number; readonly right: number }
  readonly deathLineY: number
  /** `[index, x, y, kind, speed, direction]` of each floor. */
  readonly floors: readonly (readonly [number, number, number, 'stationary' | 'moving', number, 1 | -1])[]
  readonly demands: readonly number[]
}

export interface DerivedGolden {
  readonly seed: number
  readonly salt: number
  readonly derived: number
  readonly uint32: readonly number[]
  readonly float: number
  readonly int: number
  readonly range: number
}

export interface StreamGolden {
  readonly seed: number
  readonly uint32: readonly number[]
}

export interface CourseGoldens {
  readonly source: string
  readonly cases: readonly CourseGolden[]
  readonly derived: readonly DerivedGolden[]
  readonly streams: readonly StreamGolden[]
}

export interface ComposeFrameGolden {
  /** Index into `states` and into `framings`. */
  readonly state: number
  readonly framing: number
  readonly lift: number
  readonly citySink: number
  readonly sunY: number | null
  /** `[alias, y, tileX]`; `tileX` is null for an untiled sky plate. */
  readonly layers: readonly (readonly [string, number, number | null])[]
}

export interface ComposeGoldens {
  readonly source: string
  /** The art's height of each alias, which the framing reads. */
  readonly heights: Readonly<Record<string, number>>
  readonly states: readonly {
    readonly cameraY: number
    readonly progress: number
    readonly timeSeconds: number
  }[]
  readonly framings: readonly { readonly pixelsPerUnit?: number; readonly cityTopMin?: number }[]
  readonly stages: Readonly<
    Record<
      string,
      {
        readonly labels: readonly string[]
        readonly factors: readonly number[]
        readonly frames: readonly ComposeFrameGolden[]
      }
    >
  >
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')) as T
}

export const courseGoldens = (): CourseGoldens => read('course-goldens.json')
export const composeGoldens = (): ComposeGoldens => read('compose-goldens.json')
