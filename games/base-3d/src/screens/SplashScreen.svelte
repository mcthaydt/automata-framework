<!--
  base-3d's splash (DESIGN.md §13, boot step 5): the framework's mark and the game's title until a key, a tap or
  1.5 s moves on to the menu (screens.ts).
-->
<script lang="ts">
import { ScreenFrame } from '@mcthaydt/automata-ui'

interface Props {
  title: string
}

const { title }: Props = $props()
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <p class="base3d-splash__mark">AutomataFramework</p>
    <h1 class="af-game-menu__title">{title}</h1>
    <p class="base3d-splash__hint">Press any key or tap</p>
  </div>
{/snippet}

<div class="af-game-menu" data-game-screen="splash">
  <ScreenFrame arrangement="stack" testId="splash-screen" {body} />
</div>
