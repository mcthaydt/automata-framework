// Compiles a tiny Paraglide project (en, fr) with Paraglide's own compiler, so the runtime's tests run
// against real generated code rather than a stand-in. The project is written to a temporary folder with an
// absolute path to the message-format plugin, so nothing is fetched and nothing lands in the source tree.

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@inlang/paraglide-js'

export const FIXTURE_MESSAGES = {
  en: { hello: 'Hello {name}', play: 'Play' },
  fr: { hello: 'Bonjour {name}', play: 'Jouer' },
} as const

export interface CompiledFixture {
  /** The generated `runtime.js`. */
  readonly runtime: Record<string, unknown>
  /** The generated `messages.js`. */
  readonly messages: Record<string, unknown>
}

export async function compileFixture(): Promise<CompiledFixture> {
  const folder = await mkdtemp(join(tmpdir(), 'af-paraglide-'))
  const project = join(folder, 'project.inlang')
  await mkdir(join(folder, 'messages'))
  await mkdir(project)
  const plugin = fileURLToPath(import.meta.resolve('@inlang/plugin-message-format'))
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
  return {
    runtime: (await import(/* @vite-ignore */ join(outdir, 'runtime.js'))) as Record<string, unknown>,
    messages: (await import(/* @vite-ignore */ join(outdir, 'messages.js'))) as Record<string, unknown>,
  }
}
