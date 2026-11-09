// The `af-sector/2` file as a codec: the schema that reads it and the rules that tell the diff how it is written.
// The member orders are the ones the format's examples use, so a member the editor adds lands where a hand edit would
// put it. Every id array holds objects whose `id` is unique in the file, so the diff matches elements by it.

import {
  AF_SECTOR_2_FORMAT,
  type AfSector,
  type AfSector2File,
  afFormatVersion,
  afSector2FileSchema,
  afSectorSchema,
  migrateAfSector1File,
} from '@automata/3d/level'
import type { JsonPath, PatchRules } from '@automata/editor/kit/documents'
import { createFileCodec, type FileCodec } from '../file-codec'

// The file's members in the order `AfSector2` declares them, so one the editor adds lands where a hand edit would.
const FILE_ORDER = [
  'format',
  'name',
  'title',
  'materials',
  'styles',
  'views',
  'sectors',
  'masses',
  'props',
  'cast',
  'lamps',
  'time',
  'look',
  'paths',
  'sky',
  'seed',
  'grime',
  'dress',
  'reads',
  'decals',
  'lettering',
  'entityDefs',
  'entities',
]
const SECTOR_ORDER = [
  'id',
  'floor',
  'ceiling',
  'light',
  'zone',
  'pit',
  'open',
  'view',
  'style',
  'floorTexture',
  'ceilingTexture',
  'wallTexture',
  'trim',
  'grime',
  'door',
  'dress',
  'corners',
  'holes',
]
const PROP_ORDER = ['id', 'use', 'kind', 'at', 'angle', 'with', 'layer']
const CAST_ORDER = ['id', 'who', 'pose', 'at', 'angle', 'to']
// A lamp's own members, then its light's in the order `LampPlace` declares them.
const LAMP_ORDER = [
  'id',
  'kind',
  'at',
  'color',
  'range',
  'level',
  'aim',
  'cone',
  'flicker',
  'rate',
  'seed',
  'shaft',
  'flame',
]
const ENTITY_DEF_ORDER = ['id', 'label', 'shape', 'size', 'sit', 'single', 'color', 'fields']
const ENTITY_ORDER = ['def', 'id', 'x', 'y', 'z']

const AF_SECTOR_RULES: PatchRules = {
  idArrays: ['sectors', 'props', 'cast', 'lamps', 'entityDefs', 'entities'],
  memberOrder(path: JsonPath) {
    if (path.length === 0) return FILE_ORDER
    if (path.length === 2 && path[0] === 'sectors') return SECTOR_ORDER
    if (path.length === 2 && path[0] === 'entityDefs') return ENTITY_DEF_ORDER
    if (path.length === 2 && path[0] === 'entities') return ENTITY_ORDER
    if (path.length === 2 && path[0] === 'props') return PROP_ORDER
    if (path.length === 2 && path[0] === 'cast') return CAST_ORDER
    if (path.length === 2 && path[0] === 'lamps') return LAMP_ORDER
    return undefined
  },
}

export const afSectorCodec: FileCodec<AfSector2File> = createFileCodec({
  id: 'af-sector',
  schema: afSector2FileSchema,
  rules: AF_SECTOR_RULES,
  // An `af-sector/1` file is upgraded by patching its text to the migrated model, so only the format and each wall's
  // `texture` change and every other byte stays.
  upgrade(text, codec) {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return undefined
    }
    const format = (json as { format?: unknown } | null)?.format
    if (typeof format !== 'string' || afFormatVersion(format)?.major !== 1) return undefined
    const old = afSectorSchema.safeParse(json)
    if (!old.success) return undefined
    const patched = codec.patch(
      text,
      old.data as unknown as AfSector2File,
      migrateAfSector1File(old.data as AfSector),
    )
    return patched.ok ? patched.text : undefined
  },
  // The schema refuses a newer major version; a newer minor one opens, and the schema keeps what it does not know.
  warn(doc) {
    const version = afFormatVersion(doc.format)
    if (version === undefined || version.minor === 0) return []
    return [
      {
        path: ['format'],
        message: `${doc.format} is newer than ${AF_SECTOR_2_FORMAT}: what this editor does not know is kept as written`,
      },
    ]
  },
})
