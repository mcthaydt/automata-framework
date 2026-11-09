// The sim's side of a lamp change ("a lamp change (a sim event) rebakes the meshes in range"). The sim
// switches a lamp by an entity carrying the component the game names in `Pixi3dOptions.lamps`, with fields `lamp` (a
// lamp id from the lighting content) and `level` (0 off, 1 full). The renderer reads it from the render deltas, like
// any view; nothing here is new sim API.
import type { RenderDelta, RenderRow } from '@automata/sim'
import type { LampLevels } from './vertex-light.ts'

export interface LampSwitches {
  /** Reads a step's render delta; returns every lamp level the sim now sets when one changed, else `undefined`. */
  apply(delta: RenderDelta): LampLevels | undefined
}

/** Tracks the lamp entities of `componentId`. Two entities naming one lamp: the higher StableId wins. */
export function lampSwitches(componentId: string): LampSwitches {
  const bySid = new Map<number, { readonly lamp: string; readonly level: number }>()
  let current: LampLevels = {}

  const read = (row: RenderRow): void => {
    const fields = row.components[componentId]
    const lamp = fields?.lamp
    const level = fields?.level
    // A level below 0 is off; a non-finite one is no level at all (NaN never equals itself, so it would rebake
    // every step), and the lamp keeps its content level.
    if (typeof lamp === 'string' && typeof level === 'number' && Number.isFinite(level))
      bySid.set(row.sid, { lamp, level: Math.max(0, level) })
    else bySid.delete(row.sid)
  }

  return {
    apply(delta) {
      if (delta.resync) bySid.clear()
      for (const row of delta.added) read(row)
      for (const row of delta.changed) read(row)
      for (const sid of delta.removed) bySid.delete(sid)
      const next: Record<string, number> = {}
      for (const sid of [...bySid.keys()].sort((a, b) => a - b)) {
        const entry = bySid.get(sid)
        if (entry !== undefined) next[entry.lamp] = entry.level
      }
      const ids = new Set([...Object.keys(next), ...Object.keys(current)])
      if ([...ids].every((id) => next[id] === current[id])) return undefined
      current = next
      return next
    },
  }
}
