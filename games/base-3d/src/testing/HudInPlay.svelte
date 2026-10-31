<!--
  The HUD as the default play screen draws it (@mcthaydt/automata-game's PlayScreen, not exported): ui's ScreenFrame
  with the corner Pause, the HUD inside the body's field, and the touch row when `touch` is set. For
  hud.layout.test.ts; test code.
-->
<script lang="ts">
import { ScreenFrame, TouchControls } from '@mcthaydt/automata-ui'
import Hud from '../screens/Hud.svelte'

const { touch = false }: { touch?: boolean } = $props()
const buttons = ['Attack', 'Action', 'Shield', 'Lock', 'Item'].map((label) => ({
  action: label,
  label,
  required: true,
}))
</script>

{#snippet end()}
  <button type="button" class="af-control af-control--ghost" data-testid="pause" aria-label="Pause">II</button>
{/snippet}

{#snippet body()}
  <div class="af-game-play__field"><Hud /></div>
{/snippet}

{#snippet actions()}
  <TouchControls testId="touch-buttons" {buttons} onhold={() => {}} onrelease={() => {}} />
{/snippet}

<div class="af-game-play" data-game-screen="play">
  <ScreenFrame arrangement="stack" testId="play-screen" {end} {body} actions={touch ? actions : undefined} />
</div>
