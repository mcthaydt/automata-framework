// The events a game can answer, for Feel's "When …" and Audio's "When … happens". The editor cannot run the game's code
// and sim events are code, so this gathers the ids that content can name, best first: the game's own list when it has
// one, what its feel, audio and systems files already answer, and the events of the extensions whose content the game
// has (read from the extensions' own event definitions, never retyped here). A file that does not parse is skipped.
import { CutsceneEnded, CutsceneStarted } from '@automata/cutscenes/sim'
import { openDocument } from '@automata/editor/kit/documents'
import type { SuiteWorkspace } from '@automata/editor/kit/ports'
import { NarrativeChoices, NarrativeEnded, NarrativeLine } from '@automata/narrative/sim'
import {
  PuzzleCheckpoint,
  PuzzleCutscene,
  PuzzleDialogue,
  PuzzleExit,
  PuzzleGave,
  PuzzleGoal,
  PuzzleKeypad,
  PuzzleNoise,
  PuzzleSaid,
} from '@automata/puzzle/sim'
import { SystemsCaught, SystemsLine, SystemsMode } from '@automata/systems/sim'
import { eventWords } from './event-words.ts'

/** The list of event ids a game's build may write (`content/generated` is the compiler's). */
export const EVENTS_LIST = 'content/generated/events.json'

export interface GameEvent {
  readonly id: string
  /** The id as a person reads it ("player hit"). */
  readonly words: string
  /** Where it was found, in words ("The game's events", "Already answered"). */
  readonly from: string
  /** The event is about nobody in particular (no `entity`), so a freeze or a squash on it has nothing to hold. */
  readonly noSubject: boolean
}

const FROM = {
  list: 'The game’s events',
  answered: 'Already answered',
  systems: 'Characters',
  dialogue: 'Conversations',
  cutscenes: 'Cutscenes',
  puzzles: 'Puzzles',
} as const

const EXTENSIONS: readonly {
  readonly folder: string
  readonly from: string
  readonly ids: readonly string[]
}[] = [
  { folder: 'content/systems/', from: FROM.systems, ids: [SystemsMode.id, SystemsCaught.id, SystemsLine.id] },
  {
    folder: 'content/dialogue/',
    from: FROM.dialogue,
    ids: [NarrativeLine.id, NarrativeChoices.id, NarrativeEnded.id],
  },
  { folder: 'content/cutscenes/', from: FROM.cutscenes, ids: [CutsceneStarted.id, CutsceneEnded.id] },
  {
    folder: 'content/puzzles/',
    from: FROM.puzzles,
    ids: [
      PuzzleSaid,
      PuzzleGave,
      PuzzleGoal,
      PuzzleNoise,
      PuzzleCutscene,
      PuzzleDialogue,
      PuzzleExit,
      PuzzleCheckpoint,
      PuzzleKeypad,
    ].map((event) => event.id),
  },
]

async function readValue(workspace: SuiteWorkspace, path: string): Promise<unknown> {
  const read = await workspace.read(path)
  if (read === undefined) return undefined
  try {
    return openDocument(path, read.text).value()
  } catch {
    return undefined
  }
}

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** The ids of the game's `events.json`: a list of ids, or of `{ id }` rows. */
function idsOfList(text: string | undefined): string[] {
  if (text === undefined) return []
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row: unknown) =>
      isId(row) ? [row] : isId((row as { id?: unknown } | null)?.id) ? [(row as { id: string }).id] : [],
    )
  } catch {
    return []
  }
}

export async function gameEvents(workspace: SuiteWorkspace): Promise<GameEvent[]> {
  const found = new Map<string, { from: string; noSubject: boolean }>()
  const add = (id: string, from: string, noSubject = false): void => {
    const seen = found.get(id)
    if (seen === undefined) found.set(id, { from, noSubject })
    // An extension's event is about nobody however it was first found (a feel file may already answer it).
    else if (noSubject) found.set(id, { ...seen, noSubject })
  }
  for (const id of idsOfList(await workspace.generated(EVENTS_LIST))) add(id, FROM.list)

  const files = await workspace.files()
  for (const file of files) {
    const value = (await readValue(workspace, file.path)) as
      | { entry?: { on?: unknown }[]; event?: { on?: unknown }[]; agents?: unknown }
      | undefined
    if (value === undefined || typeof value !== 'object') continue
    if (file.path.startsWith('content/feel/'))
      for (const entry of value.entry ?? []) if (isId(entry.on)) add(entry.on, FROM.answered)
    if (file.path.startsWith('content/audio/'))
      for (const row of value.event ?? []) if (isId(row.on)) add(row.on, FROM.answered)
  }
  for (const extension of EXTENSIONS)
    if (files.some((file) => file.path.startsWith(extension.folder)))
      for (const id of extension.ids) add(id, extension.from, true)

  return [...found.entries()]
    .map(([id, { from, noSubject }]) => ({ id, words: eventWords(id), from, noSubject }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** The sound ids the game has: every cue of its audio files. */
export async function audioCues(workspace: SuiteWorkspace): Promise<string[]> {
  const ids = new Set<string>()
  for (const file of await workspace.files()) {
    if (!file.path.startsWith('content/audio/')) continue
    const value = (await readValue(workspace, file.path)) as { cue?: { id?: unknown }[] } | undefined
    for (const cue of value?.cue ?? []) if (isId(cue.id)) ids.add(cue.id)
  }
  return [...ids].sort()
}

/** The audio file that has the sound `id`, as the file's value, so a page can play the sound as the game would; none if no file has it. */
export async function audioFileWith(workspace: SuiteWorkspace, id: string): Promise<unknown> {
  for (const file of await workspace.files()) {
    if (!file.path.startsWith('content/audio/')) continue
    const value = (await readValue(workspace, file.path)) as { cue?: { id?: unknown }[] } | undefined
    if (value?.cue?.some((cue) => cue.id === id)) return value
  }
  return undefined
}
