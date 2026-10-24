import type { Point } from '../../tiles/footprint'
import type { EntityDef2D, EntityInstance, Project } from '../project-types'
import { findLayer, type LayerTarget } from './layer-target'

// Where an entity is on the canvas (2D editor spec §5.5, §5.9). The canvas draws it, the select tool hits it and the
// resize handles sit on it, so the maths is here once: an instance is stored by its pivot point, and its bounds follow
// from the definition's size and pivot unless the instance was resized.

export interface Bounds {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** The rectangle an instance covers in level pixels. A `point` shape is as large as its definition says, so it can be hit. */
export function entityBounds(def: EntityDef2D, instance: EntityInstance): Bounds {
  const w = instance.w ?? def.size.w
  const h = instance.h ?? def.size.h
  return { x: instance.x - def.pivot.x * w, y: instance.y - def.pivot.y * h, w, h }
}

/**
 * The topmost instance of an entities layer under a point (the last item is drawn last, so it is on top). The top and
 * left edges belong to an instance and the bottom and right ones do not, so two neighbours never both claim a pixel.
 * An instance whose definition is gone cannot be placed, so it is skipped; the Checks report it.
 */
export function entityAt(project: Project, target: LayerTarget, at: Point): EntityInstance | undefined {
  const { layer } = findLayer(project, target)
  if (layer.kind !== 'entities') return undefined
  for (let i = layer.items.length - 1; i >= 0; i--) {
    const item = layer.items[i] as EntityInstance
    const def = project.defs.entities.find((candidate) => candidate.id === item.def)
    if (def === undefined) continue
    const box = entityBounds(def, item)
    if (at.x >= box.x && at.x < box.x + box.w && at.y >= box.y && at.y < box.y + box.h) return item
  }
  return undefined
}
