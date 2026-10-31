// What the inspector's widgets do to the level (ED3D.5f, plan decision 1; ED3D spec §5.3 flow 3, §5.4): a change names
// the field and its value, becomes the model's edit, and runs by the widget's phase. A `set` is one undo step; a scrub
// (`start`, `update`, `commit`) runs in one session, so it is one step too; `cancel` drops the session. A refusal changes
// nothing and answers the model's own sentence for the card to show.
import type { Occlude } from '../format/sector.schema'
import type { Edit } from '../model/edit'
import type { EditSession, LevelEditor } from '../model/level-editor'
import { type SetMaterialsArgs, setHeights, setLight, setMaterials } from '../model/sector-edits'
import { removeThing } from '../model/thing-edits'
import {
  type DoorArgs,
  setDoor,
  setWallFlags,
  setWallKind,
  setWallMaterial,
  setWallOcclude,
  setWindow,
  type WallFlagsArgs,
  type WindowArgs,
} from '../model/wall-edits'

type Without<T, K extends keyof T> = Omit<T, K>

/**
 * A widget edit's phase: the kit's `EditPhase`, written out because the headless layers may not import the kit's root
 * (which carries its Svelte widgets) and its `core` entry does not export it; a kit edit event's phase fits it.
 */
export type InspectorPhase = 'set' | 'start' | 'update' | 'commit' | 'cancel'

export type InspectorChange =
  | { readonly kind: 'thing'; readonly definition: string; readonly id: string; readonly remove: true }
  | { readonly kind: 'sector'; readonly id: string; readonly floor: number }
  | { readonly kind: 'sector'; readonly id: string; readonly ceiling: number }
  | { readonly kind: 'sector'; readonly id: string; readonly light: number }
  | { readonly kind: 'sector'; readonly id: string; readonly materials: Without<SetMaterialsArgs, 'id'> }
  | ({ readonly kind: 'wall'; readonly sector: string; readonly corner: number } & (
      | { readonly type: 'solid' | 'door' | 'window' }
      | { readonly door: Without<DoorArgs, 'sector' | 'corner'> }
      | { readonly window: Without<WindowArgs, 'sector' | 'corner'> }
      | { readonly texture: string | null }
      | { readonly occlude: Occlude | null }
      | { readonly flags: Without<WallFlagsArgs, 'sector' | 'corner'> }
    ))

export interface InspectorEdits {
  /** Runs `change` by the widget's phase; answers the model's sentence when it is refused. */
  change(change: InspectorChange, phase: InspectorPhase): string | undefined
}

/** The model's edit for a change. */
function editOf<D>(change: InspectorChange): Edit<D> {
  if (change.kind === 'thing') return removeThing({ def: change.definition, id: change.id })
  if (change.kind === 'sector') {
    if ('floor' in change) return setHeights({ id: change.id, floor: change.floor })
    if ('ceiling' in change) return setHeights({ id: change.id, ceiling: change.ceiling })
    if ('light' in change) return setLight({ id: change.id, light: change.light })
    return setMaterials({ id: change.id, ...change.materials })
  }
  const wall = { sector: change.sector, corner: change.corner }
  if ('type' in change) return setWallKind({ ...wall, kind: change.type })
  if ('door' in change) return setDoor({ ...wall, ...change.door })
  if ('window' in change) return setWindow({ ...wall, ...change.window })
  if ('texture' in change) return setWallMaterial({ ...wall, texture: change.texture })
  if ('occlude' in change) return setWallOcclude({ ...wall, occlude: change.occlude })
  return setWallFlags({ ...wall, ...change.flags })
}

export function createInspectorEdits<D>(editor: LevelEditor<D>): InspectorEdits {
  let session: EditSession<D> | undefined

  const answer = (result: { readonly ok: boolean; readonly reason?: string }): string | undefined =>
    result.ok ? undefined : result.reason

  return {
    change(change, phase) {
      const edit = editOf<D>(change)
      if (phase === 'set') return answer(editor.run(edit))
      if (phase === 'cancel') {
        session?.cancel()
        session = undefined
        return undefined
      }
      if (phase === 'start' || session === undefined || !session.open) session = editor.begin(edit.label)
      const result = answer(session.run(edit))
      if (phase === 'commit') {
        session.commit()
        session = undefined
      }
      return result
    },
  }
}
