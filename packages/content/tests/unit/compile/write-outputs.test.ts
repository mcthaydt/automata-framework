import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { compileContent } from '#src/features/compile/compile-content.ts'
import { buildContent, verifyContent } from '#src/features/compile/write-outputs.ts'
import { defineContentGenerator } from '#src/features/generate/content-generator.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { canonicalFile } from '#src/shared/hash/canonical-file.ts'
import { copyFixture, fixtureOptions, simRoomsOptions } from '#src/testing/fixture-game.ts'

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.either(effect))
const generated = (root: string, file = 'content.json'): string => join(root, 'content/generated', file)

/** Temporary files an atomic write may have left behind. */
const temporaries = (root: string): string[] =>
  existsSync(join(root, 'content/generated'))
    ? readdirSync(join(root, 'content/generated'), { recursive: true, encoding: 'utf8' }).filter((name) =>
        name.endsWith('.tmp'),
      )
    : []

const breakSong = (root: string): void => {
  writeFileSync(join(root, 'content/songs/dusk-run.toml'), 'displayName = "Dusk Run"\ntempoDrift = 3\n')
}

describe('compile and build', () => {
  it('check writes nothing and build writes every output', async () => {
    const root = copyFixture('valid')
    expect(Either.isRight(await run(compileContent(fixtureOptions(root))))).toBe(true)
    expect(existsSync(join(root, 'content/generated'))).toBe(false)

    const built = await run(buildContent(fixtureOptions(root)))
    if (Either.isLeft(built)) throw new Error(String(built.left))
    for (const [file, text] of built.right.files)
      expect(readFileSync(generated(root, file), 'utf8')).toBe(text)
    expect(readFileSync(generated(root, 'content.hash'), 'utf8')).toMatch(/^[0-9a-f]{16}\n$/)
  })

  it('retains prior bytes and removes temps after invalid input', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    const good = readFileSync(generated(root), 'utf8')

    breakSong(root)
    expect(Either.isLeft(await run(buildContent(fixtureOptions(root))))).toBe(true)
    expect(readFileSync(generated(root), 'utf8')).toBe(good)
    expect(temporaries(root)).toEqual([])
  })

  it('reports a missing required source without replacing good bytes', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    const good = readFileSync(generated(root), 'utf8')

    rmSync(join(root, 'content/catalog.toml'))
    const result = await run(buildContent(fixtureOptions(root)))
    expect(Either.isLeft(result) && result.left._tag === 'ContentCompileFailed').toBe(true)
    expect(readFileSync(generated(root), 'utf8')).toBe(good)
  })

  it('fails with ContentWriteFailed when an output cannot be written', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/generated'), 'a file where the folder should be')
    const result = await run(buildContent(fixtureOptions(root)))
    expect(Either.isLeft(result) && result.left._tag).toBe('ContentWriteFailed')
    expect(statSync(join(root, 'content/generated')).isFile()).toBe(true)
  })
})

// Audit of PR #8: deleting game.toml left the old ruken-fields.json behind, and ship would have read it.
describe('outputs a build no longer produces', () => {
  it('are removed by the next build, and nothing the compiler did not write is touched', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    expect(existsSync(generated(root, 'ruken-fields.json'))).toBe(true)
    writeFileSync(generated(root, 'notes.md'), 'mine\n')

    rmSync(join(root, 'content/game.toml'))
    expect(Either.isRight(await run(buildContent(fixtureOptions(root))))).toBe(true)
    expect(existsSync(generated(root, 'ruken-fields.json'))).toBe(false)
    expect(readFileSync(generated(root, 'outputs.txt'), 'utf8')).not.toContain('ruken-fields.json')
    expect(readFileSync(generated(root, 'notes.md'), 'utf8')).toBe('mine\n')
  })

  // On Windows `..\\x` leaves the output folder; on Linux it is an ordinary name, which lets this test see
  // whether a backslash entry is acted on at all.
  it('ignore an outputs.txt entry with a backslash', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    writeFileSync(generated(root, '..\\x'), 'mine\n')
    writeFileSync(generated(root, 'outputs.txt'), '..\\x\n')
    const verified = await run(verifyContent(fixtureOptions(root)))
    if (Either.isRight(verified) || verified.left._tag !== 'ContentCompileFailed')
      throw new Error('expected stale')
    expect(verified.left.diagnostics.map(formatDiagnostic).join('\n')).not.toContain('no longer produced')
    expect(Either.isRight(await run(buildContent(fixtureOptions(root))))).toBe(true)
    expect(readFileSync(generated(root, '..\\x'), 'utf8')).toBe('mine\n')
  })

  it('are removed when outputs.txt has CRLF line endings', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    const list = readFileSync(generated(root, 'outputs.txt'), 'utf8')
    writeFileSync(generated(root, 'outputs.txt'), list.replaceAll('\n', '\r\n'))
    rmSync(join(root, 'content/game.toml'))
    await run(buildContent(fixtureOptions(root)))
    expect(existsSync(generated(root, 'ruken-fields.json'))).toBe(false)
  })

  it('ignore an absolute outputs.txt entry', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    // On Linux `join` keeps `/kept.txt` inside the folder, so the file there shows whether the entry was used.
    writeFileSync(generated(root, 'kept.txt'), 'mine\n')
    writeFileSync(generated(root, 'outputs.txt'), '/kept.txt\nC:/kept.txt\n')
    await run(buildContent(fixtureOptions(root)))
    expect(readFileSync(generated(root, 'kept.txt'), 'utf8')).toBe('mine\n')
  })

  it('are stale to verify until the next build', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    rmSync(join(root, 'content/game.toml'))
    const result = await run(verifyContent(fixtureOptions(root)))
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected stale')
    // game.toml is also part of content.json, so those outputs are stale too; these are the two this is about.
    expect(result.left.diagnostics.map(formatDiagnostic)).toEqual(
      expect.arrayContaining([
        'content/generated/outputs.txt:1:1  staleArtifact: content/generated/outputs.txt does not match content/; run automata-content build',
        'content/generated/ruken-fields.json:1:1  staleArtifact: content/generated/ruken-fields.json is no longer produced; run automata-content build',
      ]),
    )
  })
})

describe('verifyContent', () => {
  const stale = async (root: string): Promise<string[]> => {
    const result = await run(verifyContent(fixtureOptions(root)))
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected stale')
    return result.left.diagnostics.map(formatDiagnostic)
  }

  it('accepts output it just wrote', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    expect(Either.isRight(await run(verifyContent(fixtureOptions(root))))).toBe(true)
  })

  it.each([
    ['missing', (path: string) => rmSync(path)],
    ['emptied', (path: string) => writeFileSync(path, '')],
    [
      'reformatted',
      (path: string) => writeFileSync(path, `${JSON.stringify(JSON.parse(readFileSync(path, 'utf8')))}\n`),
    ],
  ])('detects a %s artifact', async (_case, mutate) => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    mutate(generated(root))
    const lines = await stale(root)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^content\/generated\/content\.json:1:1 {2}staleArtifact: /)
  })

  it('names each stale file, derived ones too', async () => {
    const root = copyFixture('valid')
    await run(buildContent(fixtureOptions(root)))
    rmSync(generated(root, 'content.d.ts'))
    writeFileSync(generated(root, 'messages/en.json'), '{}\n')
    expect(await stale(root)).toEqual([
      'content/generated/content.d.ts:1:1  staleArtifact: content/generated/content.d.ts is missing; run automata-content build',
      'content/generated/messages/en.json:1:1  staleArtifact: content/generated/messages/en.json does not match content/; run automata-content build',
    ])
  })

  it('reports compile problems before staleness', async () => {
    const root = copyFixture('valid')
    breakSong(root)
    expect((await stale(root)).every((line) => line.startsWith('content/songs/dusk-run.toml'))).toBe(true)
  })
})

describe('the sim outputs (M2.2)', () => {
  it('are written beside content.json, listed, and match the partition', async () => {
    const root = copyFixture('sim-rooms')
    const built = await run(buildContent(simRoomsOptions(root)))
    if (Either.isLeft(built)) throw new Error(String(built.left))
    const { sim } = built.right
    expect(readFileSync(generated(root, 'sim-content.json'), 'utf8')).toBe(canonicalFile(sim.data))
    expect(readFileSync(generated(root, 'sim-content.hash'), 'utf8')).toBe(`${sim.hash}\n`)
    const listed = readFileSync(generated(root, 'outputs.txt'), 'utf8').split('\n')
    expect(listed).toContain('sim-content.json')
    expect(listed).toContain('sim-content.hash')
  })

  it('are stale to verify after a hand edit', async () => {
    const root = copyFixture('sim-rooms')
    await run(buildContent(simRoomsOptions(root)))
    writeFileSync(generated(root, 'sim-content.hash'), '0000000000000000\n')
    const result = await run(verifyContent(simRoomsOptions(root)))
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected stale')
    expect(result.left.diagnostics.map(formatDiagnostic)).toEqual([
      'content/generated/sim-content.hash:1:1  staleArtifact: content/generated/sim-content.hash does not match content/; run automata-content build',
    ])
  })

  // A regression guard: clashes are already refused, so this passes as soon as the built-in writes the file.
  it('cannot be written by a game generator', async () => {
    const mine = defineContentGenerator('mine', () => ({ files: { 'sim-content.json': '{}' } }))
    const result = await run(
      compileContent({ ...simRoomsOptions(copyFixture('sim-rooms')), generators: [mine] }),
    )
    if (Either.isRight(result) || result.left._tag !== 'InvalidContentConfig')
      throw new Error('expected a clash')
    expect(result.left.message).toBe('generators "artifact" and "mine" both write sim-content.json')
  })
})
