<!--
  The default play screen (DX spec §7): the game shows through; the frame holds the corner Pause and, while the
  player uses touch, the input map's touch input. In touch mode `buttons` that is the ui `TouchControls` along the
  foot (sticky, several thumbs at once, M4.3); in touch mode `swipe` it is a `SwipeSurface` over the whole screen,
  under Pause, feeding the swipe tracker.
-->
<script lang="ts">
import {
  type InputMethodTracker,
  type PointerTracker,
  ScreenFrame,
  SwipeSurface,
  TouchControls,
} from '@mcthaydt/automata-ui'
import type { TouchButton } from '../input/keys.ts'

interface Props {
  onPause: () => void
  tracker: InputMethodTracker
  touchButtons: readonly TouchButton[]
  onHold: (id: string) => void
  onRelease: (id: string) => void
  /** The swipe tracker, in touch mode `swipe`; none in mode `buttons`. */
  swipe?: PointerTracker | undefined
}

const { onPause, tracker, touchButtons, onHold, onRelease, swipe }: Props = $props()

const touching = $derived(tracker.method === 'touch')
const showButtons = $derived(touching && swipe === undefined && touchButtons.length > 0)
const buttons = $derived(
  touchButtons.map((button) => ({ action: button.id, label: button.label, required: button.required })),
)
</script>

{#snippet end()}
  <button type="button" class="af-control af-control--ghost" data-testid="pause" aria-label="Pause" onclick={onPause}
    ><span aria-hidden="true">II</span></button
  >
{/snippet}

{#snippet body()}
  <div class="af-game-play__field"></div>
{/snippet}

{#snippet actions()}
  <TouchControls testId="touch-buttons" {buttons} onhold={onHold} onrelease={onRelease} />
{/snippet}

<div class="af-game-play" data-game-screen="play">
  {#if touching && swipe !== undefined}
    <SwipeSurface tracker={swipe} />
  {/if}
  <ScreenFrame arrangement="stack" testId="play-screen" {end} {body} actions={showButtons ? actions : undefined} />
</div>
