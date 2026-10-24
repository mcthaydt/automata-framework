import type { IdSource } from '../../../model/ids'
import type { StageLayer } from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { checkIndex, freshId, insertAt, moveItem, removeAt, withKey, withTheme } from './edit-helpers'

// The Compose view's edits to the scenery (2D editor spec §10.6, EDFF.1d). `theme.layers` is back to front, so the end
// of the list is the front; the panel shows it front first and the file does not change. A layer keeps its id when it
// moves and a copy gets a new one, so the codec can tell "moved" from "removed, and another added".

/** The document with these layers; its ids too when given, else the ones it has. */
function withLayerList(
  document: StageDocument,
  layers: readonly StageLayer[],
  ids?: readonly string[],
): StageDocument {
  const themed = withTheme(document, { ...document.value.theme, layers })
  return ids === undefined ? themed : { ...themed, ids: { ...themed.ids, layers: ids } }
}

function layerAt(document: StageDocument, index: number): StageLayer {
  checkIndex('layer', index, document.value.theme.layers.length)
  return document.value.theme.layers[index] as StageLayer
}

/** Adds `layer` at `at` of the file's order (the end, in front, by default). */
export function addLayer(
  document: StageDocument,
  source: IdSource,
  layer: StageLayer,
  at: number = document.value.theme.layers.length,
): StageDocument {
  const { layers } = document.value.theme
  if (!Number.isInteger(at) || at < 0 || at > layers.length)
    throw new RangeError(`a layer cannot be added at ${at}; the list has ${layers.length}`)
  const id = freshId(source, document.ids.layers)
  return withLayerList(document, insertAt(layers, at, layer), insertAt(document.ids.layers, at, id))
}

export function removeLayer(document: StageDocument, index: number): StageDocument {
  layerAt(document, index)
  return withLayerList(
    document,
    removeAt(document.value.theme.layers, index),
    removeAt(document.ids.layers, index),
  )
}

/**
 * Puts a copy in front of the original. The copy has the original's alias, which the checks report (`duplicateAlias`)
 * until it is given another or pointed at other art.
 */
export function duplicateLayer(document: StageDocument, source: IdSource, index: number): StageDocument {
  const copy = { ...layerAt(document, index) }
  const id = freshId(source, document.ids.layers)
  return withLayerList(
    document,
    insertAt(document.value.theme.layers, index + 1, copy),
    insertAt(document.ids.layers, index + 1, id),
  )
}

/** Moves the layer at `from` so that it stands at `to` of the new order. */
export function moveLayer(document: StageDocument, from: number, to: number): StageDocument {
  layerAt(document, from)
  layerAt(document, to)
  if (from === to) return document
  return withLayerList(
    document,
    moveItem(document.value.theme.layers, from, to),
    moveItem(document.ids.layers, from, to),
  )
}

/** Sets one field of a layer; `undefined` drops an optional one. Whether the value is in range is the checks' business. */
export function setLayerField<K extends keyof StageLayer>(
  document: StageDocument,
  index: number,
  field: K,
  value: StageLayer[K],
): StageDocument {
  const layer = layerAt(document, index)
  const next = withKey(layer, field, value)
  if (next === layer) return document
  return withLayerList(
    document,
    document.value.theme.layers.map((entry, position) => (position === index ? next : entry)),
  )
}

/**
 * Moves a layer's roofline by `delta` logical units, in whole units: the game rounds a city to whole device pixels, so
 * a fraction is noise in the file. It does not clamp; a sink dragged out of its range is a finding at once. The caller
 * passes the delta from where the gesture began, to the document the gesture began with, so the whole drag is one step.
 */
export function dragLayerSink(document: StageDocument, index: number, delta: number): StageDocument {
  if (!Number.isFinite(delta)) throw new RangeError(`a layer cannot be dragged by ${delta}`)
  const layer = layerAt(document, index)
  // `+ 0` turns a negative zero into 0, which the file would otherwise spell `-0`.
  return setLayerField(document, index, 'sink', Math.round(layer.sink + delta) + 0)
}

const byDepth = (a: StageLayer, b: StageLayer): number => (a.depth < b.depth ? -1 : a.depth > b.depth ? 1 : 0)

/**
 * Lists each plate's layers back to front by depth, in the places the plate's layers already hold. The sky and city
 * layers keep their slots in the list, which is the drawing order across plates, and layers of one depth keep theirs.
 * That is the order the schema asks of each plate; it can leave a sky plate that is nearer than the layers after it
 * somewhere other than first, which the checks then report as `plateFirst`.
 */
export function sortLayersByDepth(document: StageDocument): StageDocument {
  const { layers } = document.value.theme
  const entries = layers.map((layer, index) => ({ layer, id: document.ids.layers[index] as string }))
  const sorted = [...entries]
  for (const plate of ['sky', 'city'] as const) {
    const slots = entries.flatMap((entry, index) => (entry.layer.plate === plate ? [index] : []))
    const ordered = slots
      .map((slot) => entries[slot] as (typeof entries)[number])
      .sort((a, b) => byDepth(a.layer, b.layer))
    slots.forEach((slot, position) => {
      sorted[slot] = ordered[position] as (typeof entries)[number]
    })
  }
  if (sorted.every((entry, index) => entry === entries[index])) return document
  return withLayerList(
    document,
    sorted.map((entry) => entry.layer),
    sorted.map((entry) => entry.id),
  )
}
