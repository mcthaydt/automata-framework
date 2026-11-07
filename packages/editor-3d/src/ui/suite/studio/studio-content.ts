import {
  clipSchema,
  type FigureClipDef,
  type FigureDef,
  type FigureLibrary,
  figureSchema,
  type Gait,
  gaitSchema,
  type HairStyle,
  type Headwear,
  hairStyleSchema,
  headwearSchema,
  type ItemDef,
  itemSchema,
  type MotionLibrary,
  type PoseDef,
  poseSchema,
  type RigLimits,
  rigLimitsSchema,
  type Stand,
  type Swatch,
  standSchema,
  swatchSchema,
} from '@automata/figures'
import { parse as parseToml } from 'smol-toml'
import type { ZodType } from 'zod'

// What the Studio reads of a game's figure content (EDS.9a; editor suite spec §6.2): every file of the content kinds
// it edits or draws with, parsed by the figures package's own schemas, so what the stage draws is what the game
// compiles. A file that does not parse, or fails its schema, is a problem with its path and the place; it never
// throws and never hides the files beside it (EDS-D17: a file that fails opens, and Checks lists it).

export type StudioKind =
  | 'figure'
  | 'pose'
  | 'clip'
  | 'gait'
  | 'swatch'
  | 'rig'
  | 'stand'
  | 'hair'
  | 'headwear'
  | 'item'

/** The folder name of each kind, as the game's content tree spells it. */
const FOLDERS: Readonly<Record<string, StudioKind>> = {
  figures: 'figure',
  'figure-poses': 'pose',
  'figure-clips': 'clip',
  'figure-gaits': 'gait',
  'figure-swatches': 'swatch',
  'figure-rigs': 'rig',
  'figure-stands': 'stand',
  'figure-hair': 'hair',
  'figure-headwear': 'headwear',
  'figure-items': 'item',
}

export interface StudioFile {
  readonly path: string
  readonly text: string
}

export interface StudioEntry<T> {
  readonly kind: StudioKind
  /** The file's name without its extension: the id other files name it by. */
  readonly id: string
  readonly path: string
  readonly text: string
  /** The parsed content; `undefined` when the file does not parse or fails its schema. */
  readonly value: T | undefined
}

export interface StudioProblem {
  readonly path: string
  readonly message: string
}

export interface StudioContent {
  readonly figures: readonly StudioEntry<FigureDef>[]
  readonly poses: readonly StudioEntry<PoseDef>[]
  readonly clips: readonly StudioEntry<FigureClipDef>[]
  /** Everything the figures build from, by id. */
  readonly library: FigureLibrary
  /** Everything a figure plays from, by id. */
  readonly motion: MotionLibrary
  readonly problems: readonly StudioProblem[]
}

/** The content kind of a file by its folder and extension, or `undefined` for a file the Studio does not read. */
export function kindOf(path: string): StudioKind | undefined {
  if (!path.endsWith('.toml')) return undefined
  const parts = path.split('/')
  const folder = parts[parts.length - 2]
  return folder === undefined ? undefined : FOLDERS[folder]
}

const idOf = (path: string): string => (path.split('/').pop() ?? path).replace(/\.toml$/, '')

const SCHEMAS: Readonly<Record<StudioKind, ZodType<unknown>>> = {
  figure: figureSchema,
  pose: poseSchema,
  clip: clipSchema,
  gait: gaitSchema,
  swatch: swatchSchema,
  rig: rigLimitsSchema,
  stand: standSchema,
  hair: hairStyleSchema,
  headwear: headwearSchema,
  item: itemSchema,
}

interface FoundRef {
  readonly path: readonly (string | number)[]
  readonly kind: string
  readonly id: string
}

/** The kind each reference kind names, in the Studio's folders. */
const REF_KINDS: Readonly<Record<string, StudioKind>> = {
  'figure-swatch': 'swatch',
  'figure-gait': 'gait',
  'figure-hair': 'hair',
  'figure-headwear': 'headwear',
  'figure-item': 'item',
  'figure-stand': 'stand',
  'figure-rig': 'rig',
  'figure-pose': 'pose',
}

/**
 * Replaces the schemas' reference markers (the content compiler's own, recognised by their brand as it does) with
 * their ids, and says where each was.
 */
function unwrapRefs(node: unknown, path: (string | number)[], refs: FoundRef[]): unknown {
  if (typeof node === 'object' && node !== null) {
    const marker = node as { automataContentMarker?: unknown; kind?: unknown; id?: unknown }
    if (marker.automataContentMarker === 'ref' && typeof marker.id === 'string') {
      refs.push({ path, kind: String(marker.kind), id: marker.id })
      return marker.id
    }
    if (Array.isArray(node)) return node.map((child, index) => unwrapRefs(child, [...path, index], refs))
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, unwrapRefs(child, [...path, key], refs)]),
    )
  }
  return node
}

/** The sentence for what is wrong with a file's text, or the parsed value and the references it makes. */
export function readValue(
  kind: StudioKind,
  text: string,
): { readonly value: unknown; readonly refs: readonly FoundRef[] } | { readonly problem: string } {
  let raw: unknown
  try {
    raw = parseToml(text)
  } catch (error) {
    return {
      problem: `not valid TOML: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    }
  }
  const parsed = SCHEMAS[kind].safeParse(raw)
  if (parsed.success) {
    const refs: FoundRef[] = []
    return { value: unwrapRefs(parsed.data, [], refs), refs }
  }
  const issue = parsed.error.issues[0]
  const where = issue?.path.join('.') ?? ''
  return { problem: `${where === '' ? '' : `${where}: `}${issue?.message ?? 'does not fit its schema'}` }
}

interface Found<T> extends StudioEntry<T> {
  readonly refs: readonly FoundRef[]
}

function entryOf<T>(kind: StudioKind, file: StudioFile, problems: StudioProblem[]): Found<T> {
  const read = readValue(kind, file.text)
  if ('problem' in read) problems.push({ path: file.path, message: read.problem })
  return {
    refs: 'refs' in read ? read.refs : [],
    kind,
    id: idOf(file.path),
    path: file.path,
    text: file.text,
    value: 'value' in read ? (read.value as T) : undefined,
  }
}

const byId = <T>(entries: readonly StudioEntry<T>[]): Record<string, T> =>
  Object.fromEntries(entries.flatMap((entry) => (entry.value === undefined ? [] : [[entry.id, entry.value]])))

export function readStudioContent(files: readonly StudioFile[]): StudioContent {
  const problems: StudioProblem[] = []
  const of = <T>(kind: StudioKind): Found<T>[] =>
    files
      .filter((file) => kindOf(file.path) === kind)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => entryOf<T>(kind, file, problems))
  const figures = of<FigureDef>('figure')
  const poses = of<PoseDef>('pose')
  const clips = of<FigureClipDef>('clip')
  const swatches = of<Swatch>('swatch')
  const hair = of<HairStyle>('hair')
  const headwear = of<Headwear>('headwear')
  const items = of<ItemDef>('item')
  const gaits = of<Gait>('gait')
  const stands = of<Stand>('stand')
  const rigs = of<RigLimits>('rig')
  // A reference to a file that is not there is a problem of the file that makes it, at the place it is made.
  const ids = new Map<StudioKind, Set<string>>()
  for (const group of [figures, poses, clips, swatches, hair, headwear, items, gaits, stands, rigs])
    for (const entry of group) ids.set(entry.kind, (ids.get(entry.kind) ?? new Set()).add(entry.id))
  for (const entry of [...figures, ...clips, ...poses, ...items, ...stands]) {
    for (const ref of entry.refs) {
      const kind = REF_KINDS[ref.kind]
      if (kind !== undefined && !ids.get(kind)?.has(ref.id))
        problems.push({
          path: entry.path,
          message: `${ref.path.join('.')}: ${ref.id} is no ${ref.kind.replace('figure-', 'figure ')}`,
        })
    }
  }
  return {
    figures,
    poses,
    clips,
    library: {
      swatches: byId(swatches),
      hair: byId(hair),
      headwear: byId(headwear),
      items: byId(items),
    },
    motion: {
      gaits: byId(gaits),
      poses: byId(poses),
      clips: byId(clips),
      items: byId(items),
      stands: byId(stands),
      rigs: byId(rigs),
    },
    problems,
  }
}
