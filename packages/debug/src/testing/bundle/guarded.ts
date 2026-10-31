// A game's entry as the gate asks: every debug import is reached only behind the build constant (M6-D13).
import { debugExtension, installDebug, shippedPanels } from '../../index'

export const extensions = __AUTOMATA_DEBUG__ ? [debugExtension] : []
if (__AUTOMATA_DEBUG__) installDebug({ panels: shippedPanels, driver: { state: () => 1 } })
