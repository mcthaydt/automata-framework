<!-- Writer's regions in the suite's frame: scenes and conversations, the script, and what is wrong. -->
<script module lang="ts">
import WriterCanvas from './WriterCanvas.svelte'
import WriterPanel from './WriterPanel.svelte'
import WriterStatus from './WriterStatus.svelte'
import type { WriterSession } from './writer-session.svelte.ts'

export { canvas, panel, status }
</script>

{#snippet panel(session: WriterSession)}
  <WriterPanel {session} />
{/snippet}

{#snippet canvas(session: WriterSession)}
  <WriterCanvas {session} />
{/snippet}

{#snippet status(session: WriterSession)}
  <WriterStatus {session} />
{/snippet}
