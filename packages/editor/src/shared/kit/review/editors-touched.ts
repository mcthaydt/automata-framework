import { globToRegExp } from '../player/vite-subset'

// "Feel, Levels (Start)": which editors a change touches, from the paths it changes and the game's editor list. An
// editor that opens one file per item (a level, a scene) is named with the item in brackets, so two levels read as two.

/** The part of a `[[file]]` row of the game's editor list that names an editor: the files it opens. */
export interface EditorRow {
  readonly glob: string
  readonly editor: string
}

/** A glob's part as regular expression source, without its anchors. */
const source = (glob: string): string => globToRegExp(glob).source.slice(1, -1)

/** The scene a `{scene}` glob names in `path`: "" when the glob has no scene, undefined when it does not open `path`. */
function opened(glob: string, path: string): string | undefined {
  const [before = '', after = ''] = glob.split('{scene}')
  if (!glob.includes('{scene}')) return globToRegExp(glob).test(path) ? '' : undefined
  return new RegExp(`^${source(before)}([^/]+)${source(after)}$`).exec(path)?.[1]
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** The editor's name: the suite's label when the page has the editor, else its id's first word. */
function nameOf(editor: string, labels: Readonly<Record<string, string>>): string {
  return labels[editor] ?? capitalised(editor.split('-')[0] ?? editor)
}

/** The item a file is: its name up to the first dot, "start.af2d.json" being "Start". */
function itemOf(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1)
  return capitalised(file.split('.')[0] ?? file)
}

export function editorsTouched(
  paths: readonly string[],
  rows: readonly EditorRow[],
  labels: Readonly<Record<string, string>>,
): string[] {
  const named = new Set<string>()
  for (const path of paths) {
    for (const row of rows) {
      const scene = opened(row.glob, path)
      if (scene === undefined) continue
      const name = nameOf(row.editor, labels)
      if (scene !== '') named.add(`${name} (${capitalised(scene)})`)
      else named.add(/[*?]/.test(row.glob) ? `${name} (${itemOf(path)})` : name)
      break
    }
  }
  return [...named].sort((a, b) => a.localeCompare(b))
}
