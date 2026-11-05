import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Either } from 'effect'
import { runnerImport } from 'vite'
import { describe, expect, it } from 'vitest'
import type { ContentOptions } from '#src/features/compile/compile-content.ts'
import { compileContent } from '#src/features/compile/compile-content.ts'
import { buildContent } from '#src/features/compile/write-outputs.ts'
import { copyFixture, fixtureOptions } from '#src/testing/fixture-game.ts'

type Message = (inputs?: object, options?: { locale?: string }) => string

async function build(options: ContentOptions) {
  const result = await Effect.runPromise(Effect.either(buildContent(options)))
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left, null, 2))
  return result.right
}

/** The generated modules, imported the way a game's bundle imports them. */
async function generated(root: string) {
  const folder = join(root, 'src/paraglide')
  const messages = (await import(pathToFileURL(join(folder, 'messages.js')).href)) as Record<string, Message>
  const runtime = (await import(pathToFileURL(join(folder, 'runtime.js')).href)) as {
    locales: readonly string[]
    baseLocale: string
  }
  return { messages, runtime }
}

// PRODUCT spec §4 item 1: Paraglide compiles the content compiler's catalogs into typed message functions.
describe('the Paraglide compile of the content catalogs', () => {
  it('compiles every language of the content into one messages module', async () => {
    const root = copyFixture('valid')
    await build({ ...fixtureOptions(root), paraglide: { outdir: 'src/paraglide' } })
    const { messages, runtime } = await generated(root)
    expect(runtime.locales).toEqual(['en', 'fr'])
    expect(runtime.baseLocale).toBe('en')
    expect(messages.content_stage_dawn_display_name?.({}, { locale: 'fr' })).toBe('Aube')
    expect(messages.content_stage_dawn_display_name?.({}, { locale: 'en' })).toBe('Dawn')
  })

  it('merges the game’s own catalogs after the content’s', async () => {
    const root = copyFixture('valid')
    mkdirSync(join(root, 'messages/ui'), { recursive: true })
    writeFileSync(join(root, 'messages/ui/en.json'), '{ "play": "Play" }\n')
    writeFileSync(join(root, 'messages/ui/fr.json'), '{ "play": "Jouer" }\n')
    await build({
      ...fixtureOptions(root),
      paraglide: { outdir: 'src/paraglide', catalogs: ['messages/ui/{locale}.json'] },
    })
    const { messages } = await generated(root)
    expect(messages.play?.({}, { locale: 'fr' })).toBe('Jouer')
    expect(messages.content_stage_rooftops_display_name?.({}, { locale: 'fr' })).toBe('Toits')
  })

  // Found by base-3d, the first user of the option: a game's `vite build --configLoader runner` loads this package
  // through Vite's module runner, which closes once the config is read, so an `import()` the runner rewrote fails
  // when the content compiles later ("Vite module runner has been closed").
  it('compiles when this package was loaded through a Vite module runner that has since closed', async () => {
    const root = copyFixture('valid')
    const { module } = await runnerImport<typeof import('#src/features/compile/write-outputs.ts')>(
      join(import.meta.dirname, '../../../src/features/compile/write-outputs.ts'),
      { configFile: false, logLevel: 'silent' },
    )
    const result = await Effect.runPromise(
      Effect.either(module.buildContent({ ...fixtureOptions(root), paraglide: { outdir: 'src/paraglide' } })),
    )
    expect(Either.isRight(result) ? 'built' : `${result.left._tag}: ${String(result.left.cause)}`).toBe(
      'built',
    )
    expect(existsSync(join(root, 'src/paraglide/messages.js'))).toBe(true)
  })

  it('does nothing for a game that does not ask for it', async () => {
    const root = copyFixture('valid')
    await build(fixtureOptions(root))
    expect(existsSync(join(root, 'src/paraglide'))).toBe(false)
  })

  // Paraglide empties its outdir before writing, so an outdir that holds content would delete it.
  it('refuses an outdir that is not a folder of its own, and a catalog pattern without {locale}', async () => {
    const root = copyFixture('valid')
    const refused = async (paraglide: ContentOptions['paraglide']) => {
      const result = await Effect.runPromise(
        Effect.either(compileContent({ ...fixtureOptions(root), paraglide })),
      )
      if (Either.isRight(result) || result.left._tag !== 'InvalidContentConfig')
        throw new Error('expected InvalidContentConfig')
      return result.left.message
    }
    expect(await refused({ outdir: '../elsewhere' })).toBe(
      'paraglide.outdir ../elsewhere must be a relative folder inside the project',
    )
    for (const outdir of ['content', 'content/paraglide', 'content/generated']) {
      expect(await refused({ outdir })).toBe(
        `paraglide.outdir ${outdir} is emptied on each compile, so it must not hold content`,
      )
    }
    expect(await refused({ outdir: 'src/paraglide', catalogs: ['messages/ui/en.json'] })).toBe(
      'paraglide.catalogs messages/ui/en.json must be a relative path with {locale}, ending in .json',
    )
  })
})
