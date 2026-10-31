// The panels `debug` ships (M6 spec §4.2): sim, presentation bus, feel board and audio board. Each extension's own panels join them in its row.
import { type DebugPanelDef, debugPanels } from './panels'
import AudioPanel from './panels/AudioPanel.svelte'
import BusPanel from './panels/BusPanel.svelte'
import FeelPanel from './panels/FeelPanel.svelte'
import SimPanel from './panels/SimPanel.svelte'

export const shippedPanels: readonly DebugPanelDef[] = debugPanels(
  { id: 'sim', title: 'Sim', component: SimPanel },
  { id: 'bus', title: 'Bus', component: BusPanel },
  { id: 'feel', title: 'Feel', component: FeelPanel },
  { id: 'audio', title: 'Audio', component: AudioPanel },
)
