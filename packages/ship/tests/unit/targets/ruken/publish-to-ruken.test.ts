import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { type PublishInput, publishToRuken, rukenCliPath } from '#src/targets/ruken/publish-to-ruken.ts'
import { fakeProcessRunner } from '#src/testing/fake-process-runner.ts'

const input: PublishInput = {
  distDir: '/game/dist',
  cwd: '/game',
  api: 'http://localhost:5173',
  token: 'dev-token',
  activate: true,
  game: 'g-abc123',
  cliPath: '/ruken/cli.js',
}

function publishWith(exitCode: number, stdout = '') {
  const fake = fakeProcessRunner(() => ({
    exitCode,
    stdout,
    stderr: exitCode === 0 ? '' : 'Ruken said no.\n',
  }))
  const effect = Effect.provide(publishToRuken(input), fake.layer)
  return { fake, result: Effect.runSync(Effect.either(effect)) }
}

describe('publishToRuken', () => {
  it("runs Ruken's own CLI on the build folder with the API and token in its environment", () => {
    const { fake } = publishWith(0, 'Checking...\nActive: http://g-abc123.localhost:5173/b/42/\n')
    expect(fake.runs).toHaveLength(1)
    const [run] = fake.runs
    expect(run?.command).toBe(process.execPath)
    expect(run?.args).toEqual(['/ruken/cli.js', 'publish', '/game/dist', '--activate', '--game', 'g-abc123'])
    expect(run?.options.env).toEqual({ RUKEN_API: 'http://localhost:5173', RUKEN_TOKEN: 'dev-token' })
    expect(run?.options.cwd).toBe('/game')
    expect(run?.options.echo).toBe(true)
  })

  it('leaves out --activate and --game when not asked for', () => {
    const fake = fakeProcessRunner(() => ({ exitCode: 0, stdout: 'Ready: http://x/b/1/\n', stderr: '' }))
    Effect.runSync(Effect.provide(publishToRuken({ ...input, activate: false, game: undefined }), fake.layer))
    expect(fake.runs[0]?.args).toEqual(['/ruken/cli.js', 'publish', '/game/dist'])
  })

  it('returns the URL Ruken printed', () => {
    const { result } = publishWith(0, 'Active: http://g-abc123.localhost:5173/b/42/\n')
    expect(result).toEqual(Either.right({ url: 'http://g-abc123.localhost:5173/b/42/' }))
  })

  it('maps each of Ruken’s exit codes to its own error', () => {
    const tags = [1, 2, 3, 4, 9].map((code) => {
      const { result } = publishWith(code)
      if (Either.isRight(result)) throw new Error(`exit ${code} should fail`)
      return result.left._tag
    })
    expect(tags).toEqual([
      'PublishRejected',
      'PublishUsage',
      'PublishAuth',
      'PublishTimeout',
      'PublishFailed',
    ])
  })

  it("keeps Ruken's message in the error", () => {
    const { result } = publishWith(1)
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left.message).toContain('Ruken said no.')
  })
})

describe('rukenCliPath', () => {
  it('finds the bin of the vendored @ruken/cli', () => {
    expect(rukenCliPath()).toMatch(/@ruken[/\\]cli[/\\]dist[/\\]cli\.js$/)
  })

  it("uses the copy in the published package's dist/vendor/ruken-cli when it is there (M2.4 spec §3.4)", () => {
    const built = 'file:///game/node_modules/@mcthaydt/automata-ship/dist/index.js'
    const copy = '/game/node_modules/@mcthaydt/automata-ship/dist/vendor/ruken-cli/cli.js'
    expect(rukenCliPath(built, (path) => path === copy)).toBe(copy)
  })

  it('falls back to the workspace @ruken/cli when running from src', () => {
    expect(rukenCliPath(import.meta.url, () => false)).toMatch(/@ruken[/\\]cli[/\\]dist[/\\]cli\.js$/)
  })
})
