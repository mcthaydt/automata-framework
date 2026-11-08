import { content } from 'virtual:automata/content'
import { cutsceneSchema } from '@automata/cutscenes/sim'
import { dialogueFileSchema, type LineRecord, linesFileSchema } from '@automata/narrative/sim'
import { navGraphSchema } from '@automata/nav/sim'
import { systemsDefShape } from '@automata/systems/sim'
import words from '../../../content/words/en.json'

// What the story's files say, read once: the keeper's lines and conversation, the cutscene, where the guard may walk and how
// he behaves. They are the files the editors write (`content/lines`, `dialogue`, `cutscenes`, `nav`, `systems`), already
// checked when the content compiled; reading them through their schemas again keeps a hand-edited file from reaching the sim
// half-understood.

const filesOf = (kind: Readonly<Record<string, unknown>> | undefined): unknown[] => Object.values(kind ?? {})

/** Every line record of every file in `content/lines`. */
export const LINES: readonly LineRecord[] = filesOf(content.lines).flatMap(
  (file) => linesFileSchema.parse(file).lines,
)

/** Every conversation in `content/dialogue`. */
export const GRAPHS = filesOf(content.dialogue).flatMap((file) => dialogueFileSchema.parse(file).graphs)

/** The cutscenes, by id. */
export const SCRIPTS = Object.fromEntries(
  filesOf(content.cutscene).map((file) => {
    const script = cutsceneSchema.parse(file)
    return [script.id, script] as const
  }),
)

/** Where the guard may walk: the one file in `content/nav`. */
const nav = filesOf(content['nav-graph'])[0]
if (nav === undefined) throw new Error('There is no walking graph. Add content/nav/story.toml.')
export const NAV = navGraphSchema.parse(nav)

/** How the guard behaves: the one file in `content/systems`. */
const systems = filesOf(content.systems)[0]
if (systems === undefined) throw new Error('There are no systems. Add content/systems/guard.toml.')
export const SYSTEMS = systemsDefShape.parse(systems)

const lineIndex = new Map(LINES.map((line) => [line.id, line]))
/** A line record by id, for the dialogue box and the caption. */
export const lineOf = (id: string): LineRecord | undefined => lineIndex.get(id)

const catalog: Readonly<Record<string, string>> = words
/** The words of a key, from the game's message catalog (`content/words/en.json`). */
export const wordsOf = (key: string): string | undefined => catalog[key]
