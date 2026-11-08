<!-- The audio file's problems, counted in words; and what the game cannot play, when its code lacks the part that does. -->
<script lang="ts">
import NoPlayer from '../../shared/ui/NoPlayer.svelte'
import ProblemCount from '../../shared/ui/ProblemCount.svelte'
import type { AudioSession } from './audio-session.svelte.ts'

const { session }: { session: AudioSession } = $props()
</script>

{#if !session.hasPlayer}<NoPlayer editor="audio" short />{/if}
<ProblemCount read={session.read} noun="audio file" />
