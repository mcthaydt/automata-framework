// The panels `debug` ships: sim, presentation bus, feel board, audio board and net diagnostics. Each extension's own panels join them in its row.
import { type DebugPanelDef, debugPanels } from '../../shared/panels'
import AudioPanel from './AudioPanel.svelte'
import BusPanel from './BusPanel.svelte'
import FeelPanel from './FeelPanel.svelte'
import NetPanel from './NetPanel.svelte'
import SimPanel from './SimPanel.svelte'

/** The panels debug comes with: Sim, Bus, Feel, Audio and Net. */
export const shippedPanels: readonly DebugPanelDef[] = debugPanels(
  { id: 'sim', title: 'Sim', component: SimPanel },
  { id: 'bus', title: 'Bus', component: BusPanel },
  { id: 'feel', title: 'Feel', component: FeelPanel },
  { id: 'audio', title: 'Audio', component: AudioPanel },
  { id: 'net', title: 'Net', component: NetPanel },
)
