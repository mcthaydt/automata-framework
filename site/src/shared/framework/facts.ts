import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

export interface SiteFacts {
  readonly engines: readonly EngineFact[]
  readonly examples: number
  readonly licence: string
}

const NAMES = { node: 'Node', chromium: 'Chromium', webkit: 'WebKit (Safari)', firefox: 'Firefox' } as const

export function siteFacts(root: string = repositoryRoot): SiteFacts {
  const { license } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { license?: string }
  if (license === undefined) throw new Error('The root package.json has no license.')
  const ids = ['node', ...BROWSER_ENGINES] as const
  return {
    engines: ids.map((id) => ({ id, name: NAMES[id], where: id === 'node' ? 'unit tests' : 'parity job' })),
    examples: playgroundExamples(root).length,
    licence: license,
  }
}
