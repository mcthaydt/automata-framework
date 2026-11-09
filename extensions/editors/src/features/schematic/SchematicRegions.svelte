<!-- Schematic's regions in the suite's frame: the scene's characters, the chosen one, and the file's problems. -->
<script module lang="ts">
import SchematicCanvas from './SchematicCanvas.svelte'
import SchematicInspector from './SchematicInspector.svelte'
import SchematicPanel from './SchematicPanel.svelte'
import SchematicStatus from './SchematicStatus.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

export { canvas, inspector, panel, status }
</script>

{#snippet panel(session: SchematicSession)}
  <SchematicPanel {session} />
{/snippet}

{#snippet canvas(session: SchematicSession)}
  <SchematicCanvas {session} />
{/snippet}

{#snippet status(session: SchematicSession)}
  <SchematicStatus {session} />
{/snippet}

{#snippet inspector(session: SchematicSession)}
  <SchematicInspector {session} />
{/snippet}
