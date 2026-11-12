// Where a scene's files live and how a scene is named: the name its three files share (`content/systems/<scene>.toml`,
// `content/nav/<scene>.toml`, `content/puzzles/<scene>.toml`). Kept apart from the session so the suite can list
// scenes without opening one.
export const SYSTEMS_DIR = 'content/systems/'
export const NAV_DIR = 'content/nav/'
export const PUZZLE_DIR = 'content/puzzles/'

const sceneOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.toml$/, '')

/** The scenes the files name, sorted. */
export function scenesOf(paths: readonly string[]): string[] {
  const scenes = new Set<string>()
  for (const path of paths)
    if ([SYSTEMS_DIR, NAV_DIR, PUZZLE_DIR].some((dir) => path.startsWith(dir)) && path.endsWith('.toml'))
      scenes.add(sceneOf(path))
  return [...scenes].sort()
}
