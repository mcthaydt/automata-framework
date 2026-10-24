import type { Diagnostic } from '../profile'
import { elementPath, inRange, problem, rangeText } from './check-types'
import type { StageLayer } from './stage.schema'
import type { StageDocument } from './stage-document'

// The rules of the scenery layers (EDFF.1b decision 1), by the schema's own rules and with messages for people. The list
// runs back to front: within each plate a layer may not be nearer than the one after it, a sky plate comes first among
// the sky layers, and an alias is drawn once.

/** The fields with a range, in the order the Compose inspector lists them. */
const RANGES: readonly (readonly ['depth' | 'sink' | 'haze' | 'arc' | 'drift', number, number])[] = [
  ['depth', 0, 1],
  ['sink', -720, 1440],
  ['haze', 0, 1],
  ['arc', 0, 2],
  ['drift', 0, 3],
]

function checkRanges(layer: StageLayer, path: string): Diagnostic[] {
  const name = `"${layer.alias}"`
  return RANGES.flatMap(([field, min, max]) => {
    const value = layer[field]
    if (value === undefined || inRange(value, min, max)) return []
    return [
      problem(
        'layerRange',
        `${path}.${field}`,
        rangeText(`The ${field} of ${name}`, `${name} has ${field}`, value, min, max),
      ),
    ]
  })
}

function checkKind(layer: StageLayer, path: string): Diagnostic[] {
  const name = `"${layer.alias}"`
  const found: Diagnostic[] = []
  if (layer.extend === 'plate' && layer.plate !== 'sky')
    found.push(
      problem(
        'plateOnlySky',
        `${path}.extend`,
        `${name} is a city layer; only a sky layer can be the full-frame plate.`,
      ),
    )
  if (layer.arc !== undefined && layer.plate !== 'city')
    found.push(
      problem(
        'arcOnlyCity',
        `${path}.arc`,
        `${name} is a sky layer; the ascent arc moves the city, so a sky layer has none.`,
      ),
    )
  if ((layer.drift ?? 0) > 0 && layer.extend === 'plate')
    found.push(
      problem('driftOnPlate', `${path}.drift`, `${name} is a sky plate, one picture that cannot drift.`),
    )
  return found
}

export function checkLayers(document: StageDocument): Diagnostic[] {
  const { layers } = document.value.theme
  if (layers.length === 0)
    return [
      problem(
        'noLayers',
        'theme.layers',
        'The theme needs at least one layer; the scenery is drawn from them.',
      ),
    ]

  const found: Diagnostic[] = []
  const seen = new Set<string>()
  const nearest: Record<StageLayer['plate'], { depth: number; alias: string } | undefined> = {
    sky: undefined,
    city: undefined,
  }
  let skyBefore = false
  layers.forEach((layer, index) => {
    const path = elementPath(document.ids, 'layers', index)
    const name = `"${layer.alias}"`
    found.push(...checkRanges(layer, path), ...checkKind(layer, path))
    if (layer.extend === 'plate' && skyBefore)
      found.push(
        problem(
          'plateFirst',
          `${path}.extend`,
          `The sky plate ${name} is drawn behind the light and the other sky layers, so it must be the first sky layer.`,
        ),
      )
    if (layer.plate === 'sky') skyBefore = true
    if (layer.alias === '') found.push(problem('emptyAlias', `${path}.alias`, 'A layer has no alias.'))
    else if (seen.has(layer.alias))
      found.push(problem('duplicateAlias', `${path}.alias`, `${name} is already in the list.`))
    seen.add(layer.alias)

    const before = nearest[layer.plate]
    if (before !== undefined && layer.depth < before.depth)
      found.push(
        problem(
          'layerOrder',
          `${path}.depth`,
          `${name} has depth ${layer.depth}, further than "${before.alias}" (${before.depth}) before it; list layers back to front.`,
          'reorder-layers',
        ),
      )
    // Strictly nearer replaces, so a tie names the first of the layers at that depth; NaN never compares and never replaces.
    if (!Number.isNaN(layer.depth) && (before === undefined || layer.depth > before.depth))
      nearest[layer.plate] = { depth: layer.depth, alias: layer.alias }
  })
  return found
}
