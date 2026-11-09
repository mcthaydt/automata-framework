<!-- Audio's regions in the suite's frame: the list, the chosen sound, music or event page, and the file's problems. -->
<script module lang="ts">
import ProblemCount from '../../shared/ui/ProblemCount.svelte'
import AudioCanvas from './AudioCanvas.svelte'
import AudioPanel from './AudioPanel.svelte'
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
  <ProblemCount read={session.read} noun="audio file" />
{/snippet}
