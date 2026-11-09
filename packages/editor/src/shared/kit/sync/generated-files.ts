import { parse } from 'smol-toml'

// A level project file (`start.af2d.json`) is what a person edits; the game's `project.toml`, `world.toml` and
// `levels/<id>.toml` are written from it each time the person saves. So a change to one of those on GitHub is not
// merged: the level is, and the TOML is made again from the merged level.

/** The folders a game's editors export into (`exports` in `content/editors.toml`). */
export function generatedFolders(editorsToml: string | undefined): readonly string[] {
  if (editorsToml === undefined) return []
  try {
    const files = (parse(editorsToml) as { file?: { exports?: unknown }[] }).file ?? []
    const folders = files.flatMap((file) => (typeof file.exports === 'string' ? [file.exports] : []))
    return [...new Set(folders.map((folder) => folder.replace(/^\/+|\/+$/g, '')))]
  } catch {
    return []
  }
}

/** Whether the app writes `path` from a level, rather than a person editing it. */
export function isGeneratedPath(path: string, folders: readonly string[]): boolean {
  return folders.some(
    (folder) =>
      path === `${folder}/project.toml` ||
      path === `${folder}/world.toml` ||
      (path.startsWith(`${folder}/levels/`) &&
        path.endsWith('.toml') &&
        !path.slice(folder.length + 8).includes('/')),
  )
}

/** The status line for a generated file that was changed on GitHub (by the person's other device, or by someone else). */
export const generatedNote = (path: string): string =>
  `GitHub has a newer ${path}, but the app makes that file from your level, so it was not used here. It is made again the next time you change the level.`
