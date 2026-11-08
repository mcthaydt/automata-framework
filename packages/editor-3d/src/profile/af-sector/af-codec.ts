// The `af-sector/1` file as a codec: the schema that reads it and the rules that tell the diff how it is written.
// The member orders are the ones the format's examples use, so a member the editor adds lands where a hand edit would
// put it. Every id array holds objects whose `id` is unique in the file, so the diff matches elements by it.
import type { JsonPath, PatchRules } from '@mcthaydt/automata-editor/kit/documents'
import {
  AF_SECTOR_FORMAT,
  type AfSector,
  afFormatVersion,
  afSectorSchema,
} from '../../format/af-sector.schema'
import { createFileCodec, type FileCodec } from '../file-codec'

const FILE_ORDER = ['format', 'name', 'materials', 'styles', 'sectors', 'entityDefs', 'entities']
const SECTOR_ORDER = [
  'id',
  'floor',
  'ceiling',
  'light',
  'open',
  'view',
  'style',
  'floorTexture',
  'ceilingTexture',
  'wallTexture',
  'trim',
  'corners',
  'holes',
]
const ENTITY_DEF_ORDER = ['id', 'label', 'shape', 'size', 'sit', 'single', 'color', 'fields']
const ENTITY_ORDER = ['def', 'id', 'x', 'y', 'z']

const AF_SECTOR_RULES: PatchRules = {
  idArrays: ['sectors', 'entityDefs', 'entities'],
  memberOrder(path: JsonPath) {
    if (path.length === 0) return FILE_ORDER
    if (path.length === 2 && path[0] === 'sectors') return SECTOR_ORDER
    if (path.length === 2 && path[0] === 'entityDefs') return ENTITY_DEF_ORDER
    if (path.length === 2 && path[0] === 'entities') return ENTITY_ORDER
    return undefined
  },
}

export const afSectorCodec: FileCodec<AfSector> = createFileCodec({
  id: 'af-sector',
  schema: afSectorSchema,
  rules: AF_SECTOR_RULES,
  // The schema refuses a newer major version; a newer minor one opens, and the schema keeps what it does not know.
  warn(doc) {
    const version = afFormatVersion(doc.format)
    if (version === undefined || version.minor === 0) return []
    return [
      {
        path: ['format'],
        message: `${doc.format} is newer than ${AF_SECTOR_FORMAT}: what this editor does not know is kept as written`,
      },
    ]
  },
})
