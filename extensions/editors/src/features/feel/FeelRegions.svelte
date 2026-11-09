<!-- Feel's regions in the suite's frame: the list of feels, the chosen one as sentences, and the file's problems. -->
<script module lang="ts">
import FeelCanvas from './FeelCanvas.svelte'
import FeelPanel from './FeelPanel.svelte'
import FeelStatus from './FeelStatus.svelte'
import type { FeelSession } from './feel-session.svelte.ts'

export { canvas, panel, status }
</script>

{#snippet panel(session: FeelSession)}
  <FeelPanel {session} />
{/snippet}

{#snippet canvas(session: FeelSession)}
  <FeelCanvas {session} />
{/snippet}

{#snippet status(session: FeelSession)}
  <FeelStatus {session} />
{/snippet}
