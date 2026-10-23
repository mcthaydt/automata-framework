// The Last Light file formats as codecs: the schema that reads them and the rules that tell the diff how they are
// written. The member orders are the ones Last Light's own editor uses when it adds a member (editor/src/server/
// level-edits.ts, 92e6704), so a new member lands where a hand edit would put it.
import type { JsonPath } from '../codec/locate'
import type { PatchRules } from '../codec/patch'
import { type Blockout, blockoutSchema } from '../format/blockout.schema'
import { type Facility, facilitySchema } from '../format/facility.schema'
import { createFileCodec, type FileCodec } from './file-codec'

const BLOCKOUT_ORDER = [
  'scene',
  'styles',
  'walls',
  'rooms',
  'openings',
  'masses',
  'spawn',
  'boxes',
  'hotspots',
  'lamps',
  'bounce',
  'nav',
  'zones',
  'anchors',
  'exports',
]
const ROOM_ORDER = [
  'id',
  'zone',
  'floor',
  'ceiling',
  'light',
  'open',
  'style',
  'floorTexture',
  'ceilingTexture',
  'wallTexture',
  'trim',
  'corners',
  'holes',
]
const OPENING_ORDER = [
  'id',
  'from',
  'to',
  'span',
  'zone',
  'floor',
  'ceiling',
  'light',
  'open',
  'style',
  'side',
  'door',
]
const ZONE_ORDER = ['id', 'look', 'distance', 'x', 'hysteresis', 'follow', 'depthFollow', 'area', 'enter']
const NAV_ORDER = ['derive', 'nodes', 'edges', 'drop', 'patrol']

const BLOCKOUT_RULES: PatchRules = {
  idArrays: ['rooms', 'openings', 'boxes', 'hotspots', 'lamps', 'zones'],
  memberOrder(path: JsonPath) {
    if (path.length === 0) return BLOCKOUT_ORDER
    if (path.length === 2 && path[0] === 'rooms') return ROOM_ORDER
    if (path.length === 2 && path[0] === 'openings') return OPENING_ORDER
    if (path.length === 2 && path[0] === 'zones') return ZONE_ORDER
    if (path.length === 1 && path[0] === 'nav') return NAV_ORDER
    return undefined
  },
}

const FACILITY_ORDER = ['about', 'wings', 'joins', 'street', 'phases', 'locks']

const FACILITY_RULES: PatchRules = {
  idArrays: ['wings', 'joins', 'phases', 'locks'],
  memberOrder: (path) => (path.length === 0 ? FACILITY_ORDER : undefined),
}

export const blockoutCodec: FileCodec<Blockout> = createFileCodec({
  id: 'last-light-blockout',
  schema: blockoutSchema,
  rules: BLOCKOUT_RULES,
})

export const facilityCodec: FileCodec<Facility> = createFileCodec({
  id: 'last-light-facility',
  schema: facilitySchema,
  rules: FACILITY_RULES,
})
