import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '#src/app/cli.ts'
import type { WordsOptions } from '#src/shared/words/words-args.ts'

// `automata words` routes to its own feature: the command line is read here, the run is injected, so nothing is
// translated and no model is asked.

async function words(args: string[], run?: (options: WordsOptions) => Promise<number>) {
  let stdout = ''
  let stderr = ''
  const code = await runCli(
    ['words', ...args],
    { stdout: (msg) => (stdout += msg), stderr: (msg) => (stderr += msg) },
    undefined,
    undefined,
    undefined,
    undefined,
    run === undefined ? undefined : (options) => run(options),
  )
  return { code, stdout, stderr }
}

describe('automata words', () => {
  it('--help prints its help', async () => {
    const { code, stdout } = await words(['--help'])
    expect(code).toBe(0)
    expect(stdout).toMatch(/^Usage: automata words/)
  })

  it('hands the run its options, with the folders as absolute paths', async () => {
    let seen: WordsOptions | undefined
    const { code } = await words(
      ['play', '--to', 'ja', '--dir', 'my-game', '--catalog', 'pkg/words'],
      async (options) => {
        seen = options
        return 0
      },
    )
    expect(code).toBe(0)
    expect(seen).toEqual({
      dir: resolve(process.cwd(), 'my-game'),
      key: 'play',
      to: 'ja',
      catalog: resolve(process.cwd(), 'pkg/words'),
      all: false,
      mark: false,
      source: 'en',
    })
  })

  it("returns the run's exit code", async () => {
    expect((await words([], async () => 1)).code).toBe(1)
  })

  it('an option it does not know is exit 2, with the help', async () => {
    const { code, stderr } = await words(['--bogus'], async () => 0)
    expect(code).toBe(2)
    expect(stderr).toContain('unknown option --bogus')
    expect(stderr).toContain('Usage: automata words')
  })
})
