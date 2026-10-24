// Where the things of a Last Light blockout live (ED3D spec §4.7): the `spawn` object, the `boxes`, `hotspots` and
// `lamps` lists (an element carries its `id`, and no `def`), and the `anchors` and `nav.nodes` records (named by their
// key, which is their id). A thing keeps its members in the order its file has them, so a moved box patches `x` and `z`.
// Zones and nav edges are not things yet (ED3D.7c); an edge is only something that can still name a node or a door.
import type { Thing } from '../entities/things'
import type { Blockout } from '../format/blockout.schema'
import { mergeMembers, newMembers, noThing, type ThingAccess, ThingAccessError } from './thing-access'

const LIST_KEY = { box: 'boxes', hotspot: 'hotspots', lamp: 'lamps' } as const
type ListDef = keyof typeof LIST_KEY

type Entries = Readonly<Record<string, object>>

const isListDef = (def: string): def is ListDef => Object.hasOwn(LIST_KEY, def)
const isRecordDef = (def: string): def is 'anchor' | 'node' => def === 'anchor' || def === 'node'

const listOf = (blockout: Blockout, def: ListDef): readonly (object & { readonly id: string })[] =>
  blockout[LIST_KEY[def]]

const recordOf = (blockout: Blockout, def: 'anchor' | 'node'): Entries =>
  (def === 'anchor' ? blockout.anchors : blockout.nav.nodes) ?? {}

/** The level with `record` as its anchors or its nav nodes. */
function withRecord(blockout: Blockout, def: 'anchor' | 'node', record: Entries): Blockout {
  return def === 'anchor'
    ? { ...blockout, anchors: record as Blockout['anchors'] }
    : { ...blockout, nav: { ...blockout.nav, nodes: record as Blockout['nav']['nodes'] } }
}

const withList = (blockout: Blockout, def: ListDef, list: readonly object[]): Blockout => ({
  ...blockout,
  [LIST_KEY[def]]: list,
})

/** The sentences for what names `id` through `on` (a box), in the order the checks look: hotspots, lamps, anchors, nodes. */
function attachedTo(blockout: Blockout, id: string): string[] {
  const on = `box:${id}`
  return [
    ...blockout.hotspots
      .filter((hotspot) => hotspot.on === on)
      .map((hotspot) => `hotspot ${hotspot.id} is on ${on}`),
    ...blockout.lamps.filter((lamp) => lamp.on === on).map((lamp) => `lamp ${lamp.id} is on ${on}`),
    ...Object.entries(blockout.anchors ?? {})
      .filter(([, anchor]) => anchor.on === on)
      .map(([name]) => `anchor ${name} is on ${on}`),
    ...Object.entries(blockout.nav.nodes ?? {})
      .filter(([, node]) => node.on === on)
      .map(([name]) => `node ${name} is on ${on}`),
  ]
}

function boxReferences(blockout: Blockout, id: string): string[] {
  return [
    ...attachedTo(blockout, id),
    ...(blockout.openings ?? [])
      .filter((opening) => opening.door === id)
      .map((opening) => `opening ${opening.id}: door ${id}`),
    ...(blockout.nav.edges ?? [])
      .filter(([, , door]) => door === id)
      .map(([a, b]) => `nav edge ${a}–${b}: door ${id}`),
  ]
}

function nodeReferences(blockout: Blockout, id: string): string[] {
  return [
    ...(blockout.nav.edges ?? [])
      .filter(([a, b]) => a === id || b === id)
      .map(([a, b]) => `nav edge ${a}–${b}: names ${id}`),
    ...(blockout.nav.drop ?? [])
      .filter(([a, b]) => a === id || b === id)
      .map(([a, b]) => `nav drop ${a}–${b}: names ${id}`),
    ...((blockout.nav.patrol ?? []).includes(id) ? [`nav patrol: names ${id}`] : []),
  ]
}

export const lastLightThingAccess: ThingAccess<Blockout> = {
  takenIds(blockout, def) {
    if (def === 'spawn') return ['spawn']
    if (isListDef(def)) return listOf(blockout, def).map((each) => each.id)
    return isRecordDef(def) ? Object.keys(recordOf(blockout, def)) : []
  },

  add(blockout, thing: Thing) {
    const { def, id } = thing
    if (def === 'spawn') throw new ThingAccessError('the level has a spawn already, and only one')
    if (isListDef(def)) return withList(blockout, def, [...listOf(blockout, def), newMembers(thing, { id })])
    if (isRecordDef(def))
      return withRecord(blockout, def, { ...recordOf(blockout, def), [id]: newMembers(thing, {}) })
    throw new ThingAccessError(`a blockout has no place for a ${def}`)
  },

  replace(blockout, def, id, thing) {
    if (def === 'spawn' && id === 'spawn') {
      const next = mergeMembers(blockout.spawn, thing, {})
      return next === blockout.spawn ? blockout : { ...blockout, spawn: next }
    }
    if (isListDef(def)) {
      const list = listOf(blockout, def)
      const at = list.findIndex((each) => each.id === id)
      const old = list[at]
      if (old === undefined) throw noThing(def, id)
      const next = mergeMembers(old, thing, { id })
      return next === old
        ? blockout
        : withList(
            blockout,
            def,
            list.map((each, index) => (index === at ? next : each)),
          )
    }
    const record = isRecordDef(def) ? recordOf(blockout, def) : {}
    const old = Object.hasOwn(record, id) ? record[id] : undefined
    if (!isRecordDef(def) || old === undefined) throw noThing(def, id)
    const next = mergeMembers(old, thing, {})
    return next === old ? blockout : withRecord(blockout, def, { ...record, [id]: next })
  },

  remove(blockout, def, id) {
    if (def === 'spawn') throw new ThingAccessError('a level cannot do without its spawn')
    if (isListDef(def)) {
      const list = listOf(blockout, def)
      if (!list.some((each) => each.id === id)) throw noThing(def, id)
      return withList(
        blockout,
        def,
        list.filter((each) => each.id !== id),
      )
    }
    const record = isRecordDef(def) ? recordOf(blockout, def) : {}
    if (!isRecordDef(def) || !Object.hasOwn(record, id)) throw noThing(def, id)
    // An emptied record stays an empty record, as the file has it.
    return withRecord(
      blockout,
      def,
      Object.fromEntries(Object.entries(record).filter(([name]) => name !== id)),
    )
  },

  references(blockout, def, id) {
    if (def === 'box') return boxReferences(blockout, id)
    if (def === 'node') return nodeReferences(blockout, id)
    return []
  },
}
