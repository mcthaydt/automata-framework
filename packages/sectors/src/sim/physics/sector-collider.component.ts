// Marks the fixed body sectors made for a collider span, so a new scene's map can replace them.
import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const sectorColliderFields = {
  /** The span's index in `ResolvedMap.colliders`. */
  index: 'u32',
} as const

export const SectorCollider: ComponentDef<typeof sectorColliderFields> = defineComponent(
  'sectors.collider',
  sectorColliderFields,
)
