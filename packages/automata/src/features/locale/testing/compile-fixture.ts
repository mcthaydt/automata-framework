// Compiles a tiny Paraglide project (en, fr) with Paraglide's own compiler, so the runtime's tests run
// against real generated code rather than a stand-in. The project is written under the package's
// `node_modules/.cache/` (inside Vite's root, so the test files can import it, and ignored by git) with an
// absolute path to the message-format plugin, so nothing is fetched and nothing lands in the source tree.
// It runs once per test run, in Node, from `global-setup.ts`: the inlang SDK behind the compiler rejects
// jsdom's Uint8Array (another realm), so it cannot run inside a jsdom test file.

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@inlang/paraglide-js'

export const FIXTURE_MESSAGES = {
  en: { hello: 'Hello {name}', play: 'Play' },
  fr: { hello: 'Bonjour {name}', play: 'Jouer' },
} as const

/**
 * Where the fixture is written, given the URL of a file in this folder: the package's `node_modules/.cache`, not
 * `src/`. `svelte-package -i src` lists `src/` during a build, so a fixture there that the test run then deletes
 * fails the build with ENOENT.
 */
export function fixtureFolder(from: URL): string {
  return fileURLToPath(new URL('../../../../node_modules/.cache/af-paraglide-fixture', from))
}

/** Compiles the fixture into `folder`; returns the folder holding `fixture.js` (the generated runtime and messages). */
export async function compileFixture(folder: string): Promise<string> {
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  const project = join(folder, 'project.inlang')
  await mkdir(join(folder, 'messages'))
  await mkdir(project)
  // createRequire, not import.meta.resolve, which Vite's module runner (global setup) does not support.
  const plugin = createRequire(import.meta.url).resolve('@inlang/plugin-message-format')
  await writeFile(
    join(project, 'settings.json'),
    JSON.stringify({
      baseLocale: 'en',
      locales: Object.keys(FIXTURE_MESSAGES),
      modules: [plugin],
      'plugin.inlang.messageFormat': { pathPattern: './messages/{locale}.json' },
    }),
  )
  for (const [locale, messages] of Object.entries(FIXTURE_MESSAGES)) {
    await writeFile(join(folder, 'messages', `${locale}.json`), JSON.stringify(messages))
  }
  const outdir = join(folder, 'paraglide')
  // `baseLocale` only: Paraglide's own strategies (cookie, localStorage, URL) never run; the `Locale` service answers.
  await compile({
    project,
    outdir,
    strategy: ['baseLocale'],
    emitGitIgnore: false,
    emitPrettierIgnore: false,
  })
  // One entry, so the test imports both modules through one loader and they share one runtime instance.
  await writeFile(
    join(outdir, 'fixture.js'),
    "export * as runtime from './runtime.js'\nexport * as messages from './messages.js'\n",
  )
  return outdir
}
