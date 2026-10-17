// Paraglide's compile of the content catalogs (PRODUCT spec §4 item 1). Extracted from FloorFifty
// tools/i18n/compile.ts, apps/client/i18n.config.ts and apps/client/project.inlang/settings.json (ac72660).
//
// FloorFifty commits a `project.inlang` naming its locales and the plugin's path in node_modules. Here the
// inlang project is generated for each compile in a temporary folder, from the catalogs the content compiler
// just checked (the source language first, so it is Paraglide's base locale), so a game commits no project
// file and no plugin path, and its locales are always the content's languages. A game's own catalogs (its UI
// text) join through `catalogs`, `{locale}` path patterns relative to the project root, read after the
// content's so a game key wins as FloorFifty's UI catalog does.
//
// Paraglide's own locale strategies (cookie, localStorage, URL) never run: `baseLocale` only, because the
// runtime's `Locale` service answers `getLocale` (PRODUCT.L1, `bindParaglide`). Paraglide empties `outdir`
// before writing, so the compiler refuses an `outdir` that is not a folder of its own (`paraglideProblems`).

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { ContentWriteFailed } from '../compile/errors'
import { type MessageCatalog, renderMessages } from './messages'

/** Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build. */
export interface ParaglideOptions {
  /** Where the generated `runtime.js` and `messages.js` go, relative to the root. Emptied on each compile. */
  readonly outdir: string
  /** The game's own catalogs, `{locale}` path patterns relative to the root (`messages/ui/{locale}.json`). */
  readonly catalogs?: readonly string[] | undefined
}

export interface CompileMessagesInput {
  readonly root: string
  /** The source language first. */
  readonly languages: readonly string[]
  readonly catalogs: ReadonlyMap<string, MessageCatalog>
  readonly paraglide: ParaglideOptions
}

const LOCALE = '{locale}'
const PARAGLIDE = '@inlang/paraglide-js'

/** The part of Paraglide's `CompilerOptions` used here. */
interface ParaglideCompileOptions {
  readonly project: string
  readonly outdir: string
  readonly strategy: readonly string[]
  readonly emitGitIgnore: boolean
  readonly emitPrettierIgnore: boolean
  readonly emitReadme: boolean
}

/** Mistakes in the `paraglide` option, found before anything is read. */
export function paraglideProblems(paraglide: ParaglideOptions, contentOutDir: string): string[] {
  const problems: string[] = []
  const { outdir } = paraglide
  const inside = (folder: string, parent: string): boolean =>
    folder === parent || folder.startsWith(`${parent}/`)
  const relative =
    outdir !== '' &&
    !outdir.startsWith('/') &&
    !outdir.includes('\\') &&
    outdir.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  if (!relative) problems.push(`paraglide.outdir ${outdir} must be a relative folder inside the project`)
  else if (inside(outdir, 'content') || inside('content', outdir) || inside(contentOutDir, outdir)) {
    problems.push(`paraglide.outdir ${outdir} is emptied on each compile, so it must not hold content`)
  }
  for (const pattern of paraglide.catalogs ?? []) {
    if (
      !pattern.includes(LOCALE) ||
      !pattern.endsWith('.json') ||
      pattern.startsWith('/') ||
      pattern.includes('..')
    ) {
      problems.push(`paraglide.catalogs ${pattern} must be a relative path with {locale}, ending in .json`)
    }
  }
  return problems
}

/** Reads a file, or undefined when it does not exist (a game catalog a language does not have yet). */
async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function compileInFolder(folder: string, input: CompileMessagesInput): Promise<void> {
  const { root, languages, catalogs, paraglide } = input
  const project = join(folder, 'project.inlang')
  await mkdir(project)
  const patterns = ['./messages/content/{locale}.json']
  await mkdir(join(folder, 'messages/content'), { recursive: true })
  for (const language of languages) {
    await writeFile(
      join(folder, 'messages/content', `${language}.json`),
      renderMessages(catalogs.get(language) ?? {}),
    )
  }
  for (const [index, pattern] of (paraglide.catalogs ?? []).entries()) {
    const copy = `messages/game-${index}`
    patterns.push(`./${copy}/{locale}.json`)
    await mkdir(join(folder, copy), { recursive: true })
    for (const language of languages) {
      const text = await readIfPresent(join(root, pattern.replace(LOCALE, language)))
      if (text !== undefined) await writeFile(join(folder, copy, `${language}.json`), text)
    }
  }
  // createRequire resolves the plugin from this package, so a game needs no inlang dependency of its own.
  const plugin = createRequire(import.meta.url).resolve('@inlang/plugin-message-format')
  await writeFile(
    join(project, 'settings.json'),
    JSON.stringify({
      baseLocale: languages[0],
      locales: languages,
      modules: [plugin],
      'plugin.inlang.messageFormat': { pathPattern: patterns },
    }),
  )
  // Loaded here, not at the top: a game that does not localize, and `check`, never load the inlang SDK. The
  // specifier is a variable so TypeScript does not pull Paraglide's declarations into every program that
  // type-checks this package's source (they do not check without `skipLibCheck`).
  const { compile } = (await import(PARAGLIDE)) as {
    compile: (options: ParaglideCompileOptions) => Promise<unknown>
  }
  await compile({
    project,
    outdir: join(root, paraglide.outdir),
    strategy: ['baseLocale'],
    emitGitIgnore: false,
    emitPrettierIgnore: false,
    emitReadme: false,
  })
}

/** Compiles the catalogs into `<root>/<outdir>`. A failure names the outdir, like any output that could not be written. */
export const compileMessages = (input: CompileMessagesInput): Effect.Effect<void, ContentWriteFailed> =>
  Effect.tryPromise({
    try: async () => {
      const folder = await mkdtemp(join(tmpdir(), 'automata-paraglide-'))
      try {
        await compileInFolder(folder, input)
      } finally {
        await rm(folder, { recursive: true, force: true })
      }
    },
    catch: (cause) => new ContentWriteFailed({ path: join(input.root, input.paraglide.outdir), cause }),
  })
