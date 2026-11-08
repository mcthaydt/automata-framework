import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RUNTIME_SPECIFIERS, type RuntimeManifest } from '@mcthaydt/automata-editor/kit/player'
import { createMemoryStore, type ProjectStore } from '@mcthaydt/automata-editor/kit/storage'
import { templateFiles } from '@mcthaydt/automata-tools/template-files'

/** A runtime that serves every specifier the app's runtime serves, from made-up addresses. */
export function fakeRuntime(
  version = '0.1.0',
  specifiers: readonly string[] = RUNTIME_SPECIFIERS,
): RuntimeManifest {
  return {
    packages: Object.fromEntries(
      specifiers.map((specifier) => [
        specifier,
        { version, url: `./runtime/${specifier.replaceAll('/', '_')}` },
      ]),
    ),
  }
}

/** A game in a store, from a table of path to text. */
export async function gameStore(files: Readonly<Record<string, string | Uint8Array>>): Promise<ProjectStore> {
  const store = createMemoryStore()
  for (const [path, data] of Object.entries(files)) await store.write(path, data)
  return store
}

/** The folder of a game on disk (Emberwick), without the folders a game does not carry to a phone. */
export async function gameFromDisk(root: string): Promise<ProjectStore> {
  const files: Record<string, Uint8Array> = {}
  const skip = new Set(['node_modules', '.git', '.automata', 'dist', 'tests', '.evidence', '.e2e'])
  const walk = (folder: string, prefix: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      if (entry.isDirectory()) walk(join(folder, entry.name), `${prefix}${entry.name}/`)
      else files[`${prefix}${entry.name}`] = readFileSync(join(folder, entry.name))
    }
  }
  walk(root, '')
  return gameStore(files)
}

/** The 2D starter a phone makes, written into a store. */
export async function newGame(version = '0.1.0'): Promise<ProjectStore> {
  const made = templateFiles({ id: 'lantern-run', title: 'Lantern Run', frameworkVersion: version })
  return gameStore(Object.fromEntries(made.map((file) => [file.path, file.text])))
}
