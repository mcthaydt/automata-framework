// A game that forgot the gate: the release bundle must fail the marker test.
import type { ExtensionDef } from '@automata/framework/extension'
import { debugExtension, installDebug, shippedPanels } from '../../index'

export const extensions: readonly ExtensionDef[] = [debugExtension]
installDebug({ panels: shippedPanels, driver: { state: () => 1 } })
