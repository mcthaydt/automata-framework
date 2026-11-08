// The names a person picks from in Sequence, read from the whole game, because a cutscene names no scene or level: every
// lines file (shown by its words), the characters placed with a name in the game's 2D levels, the people, lamps, doors and
// props of its 3D rooms, and whatever the cutscenes already use. Anything that does not read is skipped; Sequence reports on its own file, not on the game's others.
import { readLevel } from '@automata/3d/level'
import { levelContentSchema } from '@automata/content/level-2d'
import type { CutsceneScript } from '@automata/cutscenes/sim'
import { openDocument } from '@automata/editor/kit/documents'
import type { SuitePorts, WorkspaceFile } from '@automata/editor/kit/ports'
import type { LinesFile } from '@automata/narrative/sim'
import { humanize } from '../../shared/id-words.ts'
import type { SequenceNames } from './key-fields.ts'

const LINES_FILE = /^content\/lines\/([^/]+)\.toml$/
const LEVEL_FILE = /^content\/levels\/([^/]+)\.toml$/
const ROOM_FILE = /^content\/levels\/([^/]+)\.af-sector\.json$/
const CUTSCENE_FILE = /^content\/cutscenes\/([^/]+)\.toml$/

export interface GameNames {
  readonly lines: SequenceNames['lines']
  /** A placed character: its name and where it stands, in metres (one metre a cell). */
  readonly people: readonly { readonly name: string; readonly x: number; readonly z: number }[]
  /** The lamps, doors and props of the game's 3D rooms, by the id the level editor gave them. */
  readonly pieces: Pick<SequenceNames, 'lamps' | 'doors' | 'props'>
  /** What the game's other cutscenes use. */
  readonly used: Pick<SequenceNames, 'actors' | 'anchors' | 'lamps' | 'doors' | 'clips'>
  /** The levels, 2D and 3D, a preview can show walls from. */
  readonly levels: readonly { readonly name: string; readonly path: string }[]
}

async function readValue(ports: SuitePorts, path: string): Promise<unknown> {
  const read = await ports.workspace.read(path)
  if (read === undefined) return undefined
  try {
    return openDocument(path, read.text).value()
  } catch {
    return undefined
  }
}

/** What the cutscene script itself names, in each track. */
export function namesUsedBy(script: CutsceneScript): GameNames['used'] {
  const actors = new Set<string>()
  const anchors = new Set<string>()
  const lamps = new Set<string>()
  const doors = new Set<string>()
  const clips: Record<string, Set<string>> = {}
  for (const key of script.actor ?? []) {
    actors.add(key.who)
    if (key.at !== undefined) anchors.add(key.at)
  }
  for (const key of script.light ?? []) lamps.add(key.lamp)
  for (const key of script.doors ?? []) doors.add(key.door)
  for (const key of script.cues ?? []) {
    actors.add(key.who)
    const set = clips[key.who] ?? new Set<string>()
    set.add(key.clip)
    clips[key.who] = set
  }
  return {
    actors: [...actors],
    anchors: [...anchors],
    lamps: [...lamps],
    doors: [...doors],
    clips: Object.fromEntries(Object.entries(clips).map(([who, set]) => [who, [...set].sort()])),
  }
}

export async function readGameNames(
  ports: SuitePorts,
  everything: readonly WorkspaceFile[],
): Promise<GameNames> {
  const lines: { id: string; words: string; file: string }[] = []
  const people: { name: string; x: number; z: number }[] = []
  const levels: { name: string; path: string }[] = []
  const pieces: Record<'lamps' | 'doors' | 'props', string[]> = { lamps: [], doors: [], props: [] }
  const used: Record<'actors' | 'anchors' | 'lamps' | 'doors', Set<string>> = {
    actors: new Set(),
    anchors: new Set(),
    lamps: new Set(),
    doors: new Set(),
  }
  const clips: Record<string, Set<string>> = {}

  for (const file of everything) {
    const lineFile = LINES_FILE.exec(file.path)
    if (lineFile?.[1] !== undefined) {
      const value = (await readValue(ports, file.path)) as Partial<LinesFile> | undefined
      for (const line of value?.lines ?? [])
        lines.push({ id: line.id, words: line.words ?? '', file: humanize(lineFile[1]) })
      continue
    }
    const levelFile = LEVEL_FILE.exec(file.path)
    if (levelFile?.[1] !== undefined) {
      const parsed = levelContentSchema.safeParse(await readValue(ports, file.path))
      if (!parsed.success) continue
      levels.push({ name: parsed.data.name, path: file.path })
      for (const layer of parsed.data.layers) {
        if (layer.kind !== 'entities') continue
        for (const item of layer.items) {
          const name = item.fields.name
          if (typeof name === 'string' && name !== '') people.push({ name, x: item.x / 16, z: item.y / 16 })
        }
      }
      continue
    }
    const roomFile = ROOM_FILE.exec(file.path)
    if (roomFile?.[1] !== undefined) {
      const read = await ports.workspace.read(file.path)
      if (read === undefined) continue
      let room: ReturnType<typeof readLevel>
      try {
        room = readLevel(JSON.parse(read.text))
      } catch {
        continue
      }
      if (room.level.sectors.length === 0) continue
      levels.push({ name: room.level.title ?? room.level.name, path: file.path })
      for (const person of room.level.cast ?? [])
        people.push({ name: person.id, x: person.at[0] ?? 0, z: person.at[1] ?? 0 })
      for (const lamp of room.level.lamps ?? []) pieces.lamps.push(lamp.id)
      for (const sector of room.level.sectors) if (sector.door !== undefined) pieces.doors.push(sector.id)
      for (const prop of room.level.props ?? []) pieces.props.push(prop.id)
      continue
    }
    if (CUTSCENE_FILE.test(file.path)) {
      const script = (await readValue(ports, file.path)) as CutsceneScript | undefined
      if (script === undefined || typeof script !== 'object') continue
      const found = namesUsedBy(script)
      for (const who of found.actors) used.actors.add(who)
      for (const at of found.anchors) used.anchors.add(at)
      for (const lamp of found.lamps) used.lamps.add(lamp)
      for (const door of found.doors) used.doors.add(door)
      for (const [who, list] of Object.entries(found.clips)) {
        const set = clips[who] ?? new Set<string>()
        for (const clip of list) set.add(clip)
        clips[who] = set
      }
    }
  }
  return {
    lines,
    people,
    levels,
    pieces,
    used: {
      actors: [...used.actors],
      anchors: [...used.anchors],
      lamps: [...used.lamps],
      doors: [...used.doors],
      clips: Object.fromEntries(Object.entries(clips).map(([who, set]) => [who, [...set].sort()])),
    },
  }
}

/** The names to offer for one cutscene: the game's, then the ones this cutscene already uses. */
export function namesFor(game: GameNames, script: CutsceneScript | undefined): SequenceNames {
  const own = script === undefined ? undefined : namesUsedBy(script)
  const unique = (...lists: (readonly string[] | undefined)[]): string[] => [
    ...new Set(lists.flatMap((list) => list ?? [])),
  ]
  const actors = unique(
    game.people.map((person) => person.name),
    game.used.actors,
    own?.actors,
  )
  return {
    lines: game.lines,
    actors,
    anchors: unique(
      ['player'],
      actors.map((who) => `actor:${who}`),
      game.people.map((p) => p.name),
      game.used.anchors,
      own?.anchors,
    ),
    clips: { ...game.used.clips, ...own?.clips },
    lamps: unique(game.pieces.lamps, game.used.lamps, own?.lamps),
    doors: unique(game.pieces.doors, game.used.doors, own?.doors),
    props: unique(game.pieces.props),
  }
}
