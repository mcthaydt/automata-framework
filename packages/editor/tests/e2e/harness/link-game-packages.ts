// What a new game needs installed, worked out from the game itself. `automata create-game` writes the game's own
// package.json, and a journey about the editor should not spend minutes installing it, so each package that file names
// is linked into the game's node_modules: the repository's own package (this checkout's build or sources) when the
// workspace has one by that name, otherwise the copy a game already installed here has. A hand list of packages, or
// "whatever Emberwick installed", went stale the day `create-game` added a dependency; this follows the game.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

interface PackageJson {
  readonly name?: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

const readJson = (file: string): PackageJson => JSON.parse(readFileSync(file, 'utf8')) as PackageJson

const subfolders = (folder: string): string[] =>
  existsSync(folder)
    ? readdirSync(folder)
        .filter((name) => name !== 'node_modules' && statSync(join(folder, name)).isDirectory())
        .map((name) => join(folder, name))
    : []

// The folders a workspace pattern such as `packages/*` or `examples/2d/*/*` names (`*` is any folder).
function expand(root: string, pattern: string): string[] {
  let folders = [root]
  for (const part of pattern.split('/'))
    folders = part === '*' ? folders.flatMap(subfolders) : folders.map((folder) => join(folder, part))
  return folders.filter((folder) => existsSync(join(folder, 'package.json')))
}

/** The workspace's packages by name (the patterns under `packages:` in pnpm-workspace.yaml) to their folders. */
export function workspacePackages(root: string): Map<string, string> {
  const patterns = [
    ...(
      /^packages:\s*\n((?:[ \t]+.*\n?)*)/m.exec(
        readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'),
      )?.[1] ?? ''
    ).matchAll(/^[ \t]+-[ \t]+(\S+)/gm),
  ].map((match) => match[1] as string)
  const byName = new Map<string, string>()
  for (const folder of patterns.flatMap((pattern) => expand(root, pattern))) {
    const name = readJson(join(folder, 'package.json')).name
    if (name !== undefined) byName.set(name, folder)
  }
  return byName
}

/**
 * Links every package the game's package.json names into `<gameDir>/node_modules`. A package that is in the
 * workspace links to the workspace; any other links to the copy under `installedFrom/node_modules`. One that is
 * listed under `dependencies` and found nowhere is an error that names it (the game could not run); a missing
 * `devDependencies` entry (a type checker, a test runner) is left, as the game's dev server does not load it.
 * The links are made one by one, so the game's Vite keeps its cache (`node_modules/.vite`) in the game.
 */
export function linkGamePackages(gameDir: string, installedFrom: string, workspaceRoot: string): void {
  const wanted = readJson(join(gameDir, 'package.json'))
  const inWorkspace = workspacePackages(workspaceRoot)
  const unfound: string[] = []
  const link = (name: string, required: boolean) => {
    const target = inWorkspace.get(name) ?? join(installedFrom, 'node_modules', name)
    if (!existsSync(target)) {
      if (required) unfound.push(name)
      return
    }
    const at = join(gameDir, 'node_modules', name)
    mkdirSync(dirname(at), { recursive: true })
    symlinkSync(realpathSync(target), at, 'dir')
  }
  for (const name of Object.keys(wanted.dependencies ?? {})) link(name, true)
  for (const name of Object.keys(wanted.devDependencies ?? {})) link(name, false)
  if (unfound.length > 0)
    throw new Error(
      `the new game names ${unfound.join(', ')}, which the workspace and ${installedFrom} do not have; ` +
        'install it there, or the journeys cannot link it',
    )
}
