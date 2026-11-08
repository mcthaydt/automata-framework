<!-- A slot component as a game or an extension writes one: it reads the game through `usePlay()`, and sends a command. -->
<script lang="ts">
import { usePlay } from '../../../src/shared/ui/slots/play-context.svelte.ts'

const play = usePlay()
const tick = $derived(play.sim?.tick ?? -1)
</script>

<p data-testid="tick">{tick}</p>
<button type="button" data-testid="bump" onclick={() => play.send({ type: 'probe.bump', payload: { by: 2 } })}>Bump</button>
