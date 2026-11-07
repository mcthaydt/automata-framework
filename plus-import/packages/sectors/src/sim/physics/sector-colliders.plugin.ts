// The physics side of sectors, for a game that registers `physics3d` as well as `sectorsPlugin` (M6 spec §4.3).
import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { SectorCollider } from './sector-collider.component'

export const sectorCollidersPlugin: PluginDef = definePlugin({
  name: 'sectors-physics',
  dependsOn: ['sectors', 'physics-3d'],
  components: [SectorCollider],
})
