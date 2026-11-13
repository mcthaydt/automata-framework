import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { DEFAULT_LOCALES } from '@automata/content/locale'
import { decodeReplay } from '@automata/sim/replay'
import { BROWSER_ENGINES } from '@automata/vitest-preset/engines'
import { playgroundExamples } from './examples.ts'
import { repositoryRoot } from './root.ts'

// The plain facts Home states as numbers, read from the workspace so a page cannot say one the repository does not
// back: the engines are the ones every parity test runs in (and Node, the unit tests), the examples are the ones the
// examples pages list, the licence is the root package's.

/** One engine a game's result is checked in, and where. */
export interface EngineFact {
  readonly id: 'node' | (typeof BROWSER_ENGINES)[number]
  readonly name: string
  readonly where: string
}

/** The golden Home's Checks table names: a recorded run every engine has to end at the same hash of. */
export interface GoldenFact {
  readonly file: string
  readonly ticks: number
  /** The sim's hash at the end of the recording: 16 hex digits. */
  readonly hash: string
}

const GOLDEN = 'examples/2d/__goldens__/shapes-rects.replay'

/** The golden's ticks and final hash, read from the committed `.replay` (raw deflate over the encoded replay). */
export function goldenFact(root: string = repositoryRoot): GoldenFact {
  const replay = decodeReplay(new Uint8Array(inflateRawSync(readFileSync(join(root, GOLDEN)))))
  return {
    file: GOLDEN.slice(GOLDEN.lastIndexOf('/') + 1),
    ticks: replay.finalTick - replay.header.startTick,
    hash: replay.finalHash,
  }
}

export interface SiteFacts {
  readonly engines: readonly EngineFact[]
  readonly examples: number
  /** The languages a new game ships (the default locales), counting the one its words are written in. */
  readonly languages: number
  readonly licence: string
  readonly golden: GoldenFact
}

const NAMES = { node: 'Node', chromium: 'Chromium', webkit: 'WebKit (Safari)', firefox: 'Firefox' } as const

export function siteFacts(root: string = repositoryRoot): SiteFacts {
  const { license } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { license?: string }
  if (license === undefined) throw new Error('The root package.json has no license.')
  const ids = ['node', ...BROWSER_ENGINES] as const
  return {
    engines: ids.map((id) => ({ id, name: NAMES[id], where: id === 'node' ? 'unit tests' : 'parity job' })),
    examples: playgroundExamples(root).length,
    languages: DEFAULT_LOCALES.length,
    licence: license,
    golden: goldenFact(root),
  }
}
