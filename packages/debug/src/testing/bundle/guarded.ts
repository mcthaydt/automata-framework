// A game's entry as the gate asks: every debug import is reached only behind the build constant (M6-D13).
import type { ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { debugExtension, installDebug, shippedPanels } from '../../index'

export const extensions: readonly ExtensionDef[] = __AUTOMATA_DEBUG__ ? [debugExtension] : []
if (__AUTOMATA_DEBUG__) installDebug({ panels: shippedPanels, driver: { state: () => 1 } })
