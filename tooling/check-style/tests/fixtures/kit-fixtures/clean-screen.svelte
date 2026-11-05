<!--
  A kit screen that stays inside the game's frame: a name entry and a results list.
  Ruken draws its own chrome around the frame; this comment may name it.
-->
<script lang="ts">
// The host's name comes from the host at run time (hostName), never from the kit: Ruken is not written here.
let { hostName, onexit }: { hostName: string; onexit: () => void } = $props()
let playerName = $state('')
const title = 'Results'
</script>

<h1>{title}</h1>
<label>Your name <input type="text" autocomplete="nickname" bind:value={playerName} /></label>
<button type="button" class="af-control" onclick={onexit}>Back to {hostName}</button>
