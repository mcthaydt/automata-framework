<!--
  The default play screen (DX spec §7): the game shows through; the frame holds the corner Pause
  and, while the player uses touch, the input map's touch buttons along the foot. A touch button
  holds while pressed (pointerdown to pointerup or cancel), so it reads as a held key.
-->
<script lang="ts">
import { type InputMethodTracker, ScreenFrame } from '@mcthaydt/automata-ui'
import type { TouchButton } from '../input/keys.ts'

interface Props {
  onPause: () => void
  tracker: InputMethodTracker
  touchButtons: readonly TouchButton[]
  onHold: (id: string) => void
  onRelease: (id: string) => void
}

const { onPause, tracker, touchButtons, onHold, onRelease }: Props = $props()

const showTouch = $derived(tracker.method === 'touch' && touchButtons.length > 0)

function press(event: PointerEvent, id: string): void {
  event.preventDefault()
  const button = event.currentTarget as HTMLElement
  if (event.pointerId !== undefined && typeof button.setPointerCapture === 'function') {
    try {
      button.setPointerCapture(event.pointerId)
    } catch {
      // A synthetic or already-ended pointer has nothing to capture; the hold still counts.
    }
  }
  onHold(id)
}
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
  <div class="af-game-play__touch" data-testid="touch-buttons">
    {#each touchButtons as button (button.id)}
      <button
        type="button"
        class="af-control af-game-play__touch-button"
        data-testid={button.id}
        tabindex="-1"
        onpointerdown={(event) => press(event, button.id)}
        onpointerup={() => onRelease(button.id)}
        onpointercancel={() => onRelease(button.id)}
        oncontextmenu={(event) => event.preventDefault()}
      >{button.label}</button>
    {/each}
  </div>
{/snippet}

<div class="af-game-play" data-game-screen="play">
  <ScreenFrame arrangement="stack" testId="play-screen" {end} {body} actions={showTouch ? actions : undefined} />
</div>
