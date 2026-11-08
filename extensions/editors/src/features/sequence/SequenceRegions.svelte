<!-- Sequence's regions in the suite's frame: the cutscenes, the scene being laid out, and what is wrong with it. -->
<script module lang="ts">
import SequenceCanvas from './SequenceCanvas.svelte'
import SequencePanel from './SequencePanel.svelte'
import SequenceStatus from './SequenceStatus.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'

export { canvas, panel, status }
</script>

{#snippet panel(session: SequenceSession)}
  <SequencePanel {session} />
{/snippet}

{#snippet canvas(session: SequenceSession)}
  <SequenceCanvas {session} />
{/snippet}

{#snippet status(session: SequenceSession)}
  <SequenceStatus {session} />
{/snippet}
