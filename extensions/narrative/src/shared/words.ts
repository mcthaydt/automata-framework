// The words of every line, by the line's `text` key, for the dialogue box and the captions. A line's words are a
// translatable text of the `lines` content kind, so its message key is made from its file's content id and its place
// in the file; `createContentText` owns that key, so this builds none.
import type { ContentText } from '@automata/content/locale'
import type { LinesFile } from './sim/lines.schema'

/**
 * Each line that has `words`, keyed by its `text`: the words in the active locale when `text` is given, else the
 * source words. `files` are keyed by the lines file's content id (`shop` for `content/lines/shop.toml`). A line with no
 * words is absent, so the box can report it once.
 */
export function wordsOf(
  files: Readonly<Record<string, LinesFile>>,
  text?: ContentText,
): ReadonlyMap<string, string> {
  const words = new Map<string, string>()
  for (const [fileId, file] of Object.entries(files)) {
    file.lines.forEach((line, index) => {
      if (line.words === undefined) return
      words.set(
        line.text,
        text === undefined ? line.words : text('lines', fileId, ['lines', index, 'words'], line.words),
      )
    })
  }
  return words
}
