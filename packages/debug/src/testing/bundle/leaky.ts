// A game that forgot the gate: the release bundle must fail the marker test.
import { debugExtension, installDebug, shippedPanels } from '../../index'

export const extensions = [debugExtension]
installDebug({ panels: shippedPanels, driver: { state: () => 1 } })
