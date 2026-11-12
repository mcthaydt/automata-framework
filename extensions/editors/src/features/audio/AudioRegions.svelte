<!-- Audio's regions in the suite's frame: the list, the chosen sound, music or event page, and the file's problems. -->
<script module lang="ts">
import AudioCanvas from './AudioCanvas.svelte'
import AudioPanel from './AudioPanel.svelte'
import AudioStatus from './AudioStatus.svelte'
import type { AudioSession } from './audio-session.svelte.ts'

export { canvas, panel, status }
</script>

{#snippet panel(session: AudioSession)}
  <AudioPanel {session} />
{/snippet}

{#snippet canvas(session: AudioSession)}
  <AudioCanvas {session} />
{/snippet}

{#snippet status(session: AudioSession)}
  <AudioStatus {session} />
{/snippet}
