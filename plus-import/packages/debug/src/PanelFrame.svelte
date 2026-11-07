<script lang="ts">
// Renders one panel and tells it its own id through context, so a generic panel (a summary) can find its source (DBG-D4).
import { setContext, untrack } from 'svelte'
import { PANEL_CONTEXT } from './host'
import type { DebugPanelDef } from './panels'

const { panel }: { panel: DebugPanelDef } = $props()
// The overlay keys this component by the panel, so the id is read once, at mount.
setContext(
  PANEL_CONTEXT,
  untrack(() => panel.id),
)
const Panel = $derived(panel.component)
</script>

<Panel />
