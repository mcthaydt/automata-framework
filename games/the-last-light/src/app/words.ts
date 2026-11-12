import { content } from 'virtual:automata/content'
import { cutsceneSchema } from '@automata/cutscenes/sim'
import { wordsOf as wordsOfLines } from '@automata/narrative'
import { type LineRecord, type LinesFile, linesFileSchema } from '@automata/narrative/sim'
import ui from '../../messages/ui/en.json'

// What the screen says, in English: a line's words (the files Writer edits, `content/lines`), else the interface's words
// (`messages/ui/en.json`: the names of the hotspots and the few fixed words). A key with no words is nothing, never a key shown
// to a player. Other languages' catalogs are workstream 1's six (task 18); the story's own lines stay in English until they
// are translated.

const kinds = content as unknown as Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>

const LINE_FILES: Readonly<Record<string, LinesFile>> = Object.fromEntries(
  Object.entries(kinds.lines ?? {}).map(([name, file]) => [name, linesFileSchema.parse(file)]),
)
const LINES = new Map<string, LineRecord>(
  Object.values(LINE_FILES).flatMap((file) => file.lines.map((line) => [line.id, line] as const)),
)
const lineWords = wordsOfLines(LINE_FILES)
const catalog: Readonly<Record<string, string>> = ui

/** A line record by id: the caption reads its speaker and its delivery. */
export const lineOf = (id: string): LineRecord | undefined => LINES.get(id)

/** The words of a key: a line's, else the interface's. */
export const wordsOf = (key: string): string | undefined => lineWords.get(key) ?? catalog[key]

/** The cutscene scripts by id, for the caption to read what is up at this moment. */
export const SCRIPTS = Object.fromEntries(
  Object.values(kinds.cutscene ?? {}).map((file) => {
    const script = cutsceneSchema.parse(file)
    return [script.id, script] as const
  }),
)
