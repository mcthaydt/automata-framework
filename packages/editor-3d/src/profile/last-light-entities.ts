// Last Light's fixed things in the shared entity model (ED3D spec §4.7): the definitions its blockout has built in (the
// spawn, boxes, hotspots, lamps, anchors, nav nodes and camera zones), and its arrays read as things of them. The format
// has no `entityDefs`, so the definitions are fixed here, read-only, and shaped by what the four shipped blockouts hold:
// each has a test that every value in them fits its field. The editor core never names one of these; it reads the kit.
//
// A camera zone's definition and how it is read are `last-light-zones.ts`'s (ED3D.7c). A nav edge is no thing: it joins
// two nodes, and is the profile's link (`last-light-nav-links.ts`). A lamp's colour stays the three floats the file has,
// and `on` (`box:bed`, `wall:hall/2`) stays the text the file has.
import type { ThingDef } from '../entities/thing-def.schema'
import { type EntityKit, type RawEntry, readEntityKit } from '../entities/things'
import type { Blockout, BoxKind, BoxRole } from '../format/blockout.schema'
import { zoneDefinition, zoneEntry } from './last-light-zones'

const BOX_KINDS: readonly BoxKind[] = ['desk', 'bench', 'bed', 'exit', 'door', 'furniture']
const BOX_ROLES: readonly BoxRole[] = ['collider', 'seat', 'door']

/** The size of a box is at least a centimetre; the smallest of the shipped ones is 10 cm. */
const BOX_SIDE = { type: 'float', min: 0.01, required: true } as const

export const lastLightDefinitions: readonly ThingDef[] = [
  {
    id: 'spawn',
    shape: 'point',
    single: true,
    sit: 'free',
    fields: [{ id: 'facing', type: 'angle', required: true }],
  },
  {
    id: 'box',
    shape: 'box',
    sit: 'free',
    fields: [
      { id: 'w', ...BOX_SIDE },
      { id: 'h', ...BOX_SIDE },
      { id: 'd', ...BOX_SIDE },
      { id: 'kind', type: 'enum', options: BOX_KINDS, required: true },
      { id: 'role', type: 'enum', options: BOX_ROLES, required: true },
    ],
  },
  {
    id: 'hotspot',
    shape: 'point',
    sit: 'free',
    fields: [
      { id: 'name', type: 'text', required: true },
      { id: 'reach', type: 'float', min: 0, required: true },
      { id: 'hide', type: 'bool' },
      { id: 'on', type: 'text' },
    ],
  },
  {
    id: 'lamp',
    shape: 'point',
    sit: 'free',
    fields: [
      { id: 'range', type: 'float', min: 0, required: true },
      { id: 'radius', type: 'float', min: 0, required: true },
      { id: 'color', type: 'float', list: true, min: 0, max: 1, required: true },
      { id: 'kind', type: 'text' },
      { id: 'on', type: 'text' },
    ],
  },
  {
    id: 'anchor',
    shape: 'point',
    sit: 'free',
    fields: [
      { id: 'radius', type: 'float', min: 0 },
      { id: 'on', type: 'text' },
    ],
  },
  // A nav node is a point on the floor: the file gives it an x and a z and no height.
  { id: 'node', shape: 'point', sit: 'floor', fields: [{ id: 'on', type: 'text' }] },
  zoneDefinition,
]

/** The entries of a record as instances of a definition, named by their keys (an anchor and a nav node have no id of their own). */
const named = (
  def: string,
  record: Readonly<Record<string, object>> | undefined,
  path: readonly (string | number)[],
): RawEntry[] =>
  Object.entries(record ?? {}).map(([id, value]) => ({ path: [...path, id], value: { ...value, def, id } }))

const listed = (def: string, items: readonly object[], path: string): RawEntry[] =>
  items.map((value, index) => ({ path: [path, index], value: { ...value, def } }))

export function lastLightEntityKit(blockout: Blockout): EntityKit {
  return readEntityKit({
    definitions: lastLightDefinitions.map((value, index) => ({ path: ['definitions', index], value })),
    instances: [
      { path: ['spawn'], value: { ...blockout.spawn, def: 'spawn', id: 'spawn' } },
      ...listed('box', blockout.boxes, 'boxes'),
      ...listed('hotspot', blockout.hotspots, 'hotspots'),
      ...listed('lamp', blockout.lamps, 'lamps'),
      ...named('anchor', blockout.anchors, ['anchors']),
      ...named('node', blockout.nav.nodes, ['nav', 'nodes']),
      ...blockout.zones.map(zoneEntry),
    ],
  })
}
