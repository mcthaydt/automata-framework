import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readmeCommands, readWorkspace, unresolvedCommands } from '#src/readme.ts'

// The root README's commands are a contract (QB spec §4.1): a reader who clones the repository and types
// them gets a running Emberwick. These tests hold every command to a script, package or file that exists.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const fixture = fileURLToPath(new URL('../../fixtures/readme/README.md', import.meta.url))

describe('readmeCommands', () => {
  it('reads every line of the sh blocks, dropping comments and splitting on &&', () => {
    const markdown = [
      'Text with `pnpm ignored` inline.',
      '```sh',
      '# a comment line',
      'pnpm install',
      'pnpm build && node tooling/x.ts --from packs   # trailing comment',
      '',
      '```',
      '```ts',
      'pnpm not-shell',
      '```',
    ].join('\n')
    expect(readmeCommands(markdown)).toEqual(['pnpm install', 'pnpm build', 'node tooling/x.ts --from packs'])
  })
})

describe('unresolvedCommands', () => {
  const workspace = readWorkspace(root)

  it('names each command in a fixture README that does not resolve, once each', () => {
    const problems = unresolvedCommands(readmeCommands(readFileSync(fixture, 'utf8')), workspace)
    expect(problems).toEqual([
      'pnpm no-such-script: the root package.json has no "no-such-script" script',
      'pnpm --filter @af-examples/missing dev: no workspace package is named "@af-examples/missing"',
      'pnpm --filter @af-games/emberwick serve: @af-games/emberwick has no "serve" script',
      'node tooling/missing/src/run.ts: tooling/missing/src/run.ts does not exist',
      'make all: not a command this check knows (git clone, cd, corepack enable, pnpm, node)',
    ])
  })

  it('finds nothing wrong with the root README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8')
    const commands = readmeCommands(readme)
    expect(commands.length).toBeGreaterThan(0)
    expect(unresolvedCommands(commands, workspace)).toEqual([])
  })
})
