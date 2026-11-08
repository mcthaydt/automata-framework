// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing
// it from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows Emberwick's installed
// packages instead, which are this checkout's own builds of the same framework, so a journey about the editor does not
// spend minutes installing. Each package is linked one by one into the game's own node_modules, so the game's Vite keeps
// its cache (`node_modules/.vite`) in the game: a cache shared with Emberwick's would make one dev server reload the
// other's page. A package the new game names that Emberwick does not use (Feel and Audio's players, which a new game plays)
// is linked from the workspace, as `pnpm install` would link it.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { BIN } from './run-editor.ts'
import type { TempGame } from './temp-game.ts'

/**
 * Makes a new game in a fresh folder and links its packages from `installedFrom` (Emberwick for a 2D game, base-3d for a
 * 3D one, whose installs hold the 3D package and Pixi 3D). `template` is `create-game`'s `--template`.
 */
export async function newGame(
  installedFrom: string,
  template: '2d' | '3d' = '2d',
  name = 'my-game',
): Promise<TempGame> {
  const folder = mkdtempSync(join(tmpdir(), 'af-journey-new-'))
  await promisify(execFile)(process.execPath, [BIN, 'create-game', name, '--template', template], {
    cwd: folder,
  })
  const dir = join(folder, name)
  const installed = join(installedFrom, 'node_modules')
  mkdirSync(join(dir, 'node_modules'))
  for (const entry of readdirSync(installed))
    if (entry !== '.vite' && entry !== '@automata')
      symlinkSync(join(installed, entry), join(dir, 'node_modules', entry), 'dir')
  const scoped = join(dir, 'node_modules', '@automata')
  mkdirSync(scoped)
  for (const name of automataPackages(dir)) {
    const from = existsSync(join(installed, '@automata', name))
      ? join(installed, '@automata', name)
      : WORKSPACE.get(name)
    if (from !== undefined) symlinkSync(from, join(scoped, name), 'dir')
  }
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}

const REPO = fileURLToPath(new URL('../../../../../', import.meta.url))

/** The workspace's `@automata/*` packages and extensions, by the name after the scope. */
const WORKSPACE: ReadonlyMap<string, string> = new Map(
  ['packages', 'extensions'].flatMap((group) =>
    readdirSync(join(REPO, group)).flatMap((folder): [string, string][] => {
      const manifest = join(REPO, group, folder, 'package.json')
      if (!existsSync(manifest)) return []
      const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }
      return name?.startsWith('@automata/')
        ? [[name.slice('@automata/'.length), join(REPO, group, folder)]]
        : []
    }),
  ),
)

/** Every `@automata/*` package the game's manifest names, by the name after the scope. */
function automataPackages(dir: string): string[] {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >
  const names = ['dependencies', 'devDependencies'].flatMap((field) => Object.keys(manifest[field] ?? {}))
  return [...new Set(names.filter((name) => name.startsWith('@automata/')))].map((name) =>
    name.slice('@automata/'.length),
  )
}
