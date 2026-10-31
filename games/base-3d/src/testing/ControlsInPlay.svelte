<!--
  The touch controls as base-3d's play screen draws them (@mcthaydt/automata-game's PlayScreen, not exported): the
  camera drag surface under a ScreenFrame with Pause, the floating stick, and the five buttons of DESIGN.md §14.4 in
  the `end` group, all required. The button specs are the page's own (`input.touchButtons`, asserted in
  screens/controls.test.ts). For controls.layout.test.ts; test code.
-->
<script lang="ts">
import { CameraDragSurface, ScreenFrame, TouchControls } from '@mcthaydt/automata-ui'

const idle = {
  down: () => false,
  move: () => undefined,
  up: () => undefined,
  cancel: () => undefined,
}
const none = (): void => undefined
const buttons = ['Attack', 'Action', 'Shield', 'Lock', 'Item'].map((label) => ({
  action: label.toLowerCase(),
  label,
  side: 'end' as const,
  required: true,
}))
</script>

<div class="af-game-play" data-game-screen="play">
  <CameraDragSurface tracker={idle} />
  <ScreenFrame arrangement="stack" testId="play-screen">
    {#snippet end()}
      <button type="button" class="af-control af-control--ghost" data-testid="pause" aria-label="Pause" onclick={none}
        ><span aria-hidden="true">II</span></button
      >
    {/snippet}
    {#snippet body()}<div class="af-game-play__field"></div>{/snippet}
    {#snippet actions()}
      <TouchControls testId="touch-buttons" stick={{ label: 'Move' }} {buttons} onhold={none} onrelease={none} />
    {/snippet}
  </ScreenFrame>
</div>
