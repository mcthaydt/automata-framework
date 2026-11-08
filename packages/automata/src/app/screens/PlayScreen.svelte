<!--
  The default play screen: the game shows through; the frame holds the corner Pause and, while the
  player uses touch, the input map's touch input. In touch mode `buttons` that is the ui `TouchControls` along the
  foot (sticky, several thumbs at once); in touch mode `swipe` it is a `SwipeSurface` over the whole screen,
  under Pause, feeding the swipe tracker.
-->
<script lang="ts">
import type { TouchButton } from '../../features/input/keys.ts'
import { type InputMethodTracker } from '../../shared/ui/browser/input-method.svelte'
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import { PlaySession, providePlay } from '../../shared/ui/slots/play-context.svelte.ts'
import { type UiComponent } from '../../shared/ui/slots/ui-slot'
import CameraDragSurface from '../../shared/ui/touch/CameraDragSurface.svelte'
import { type DragTracker } from '../../shared/ui/touch/camera-drag-surface'
import SwipeSurface from '../../shared/ui/touch/SwipeSurface.svelte'
import { type PointerTracker } from '../../shared/ui/touch/swipe-surface'
import TouchControls from '../../shared/ui/touch/TouchControls.svelte'
import type { LiveScreensCopy } from './screens-copy.svelte.ts'

interface Props {
  onPause: () => void
  /** The screens' words in the player's language. */
  copy: LiveScreensCopy
  tracker: InputMethodTracker
  touchButtons: readonly TouchButton[]
  onHold: (id: string) => void
  onRelease: (id: string) => void
  /** The swipe tracker, in touch mode `swipe`; none in mode `buttons`. */
  swipe?: PointerTracker | undefined
  /** The extensions' `hud.overlay` components, drawn over the game inside the visible region. */
  hud?: readonly UiComponent[] | undefined
  /** The running game, for `usePlay()` in the `hud` components; none makes the hud components' `usePlay()` throw. */
  play?: PlaySession | undefined
  /** The camera-drag tracker, when the input map binds `camera-drag`; none draws no surface. */
  drag?: DragTracker | undefined
  /** The touch stick, when the input map asks for it: its vector and its release. */
  stick?: { onstick: (x: number, y: number) => void; onstickend: () => void } | undefined
}

const {
  onPause,
  tracker,
  touchButtons,
  onHold,
  onRelease,
  swipe,
  hud = [],
  play,
  copy,
  drag,
  stick,
}: Props = $props()

// Svelte contexts are read while a component is made, so it is given before the hud components are.
// svelte-ignore state_referenced_locally
if (play !== undefined) providePlay(play)
// The hud components read the game each frame, so the session is told when one passes; nothing to do with no hud.
$effect(() => {
  if (play === undefined || hud.length === 0) return
  let frame = 0
  const tick = (): void => {
    play.refresh()
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
})

const touching = $derived(tracker.method === 'touch')
const showButtons = $derived(
  touching && swipe === undefined && (touchButtons.length > 0 || stick !== undefined),
)
const buttons = $derived(
  touchButtons.map((button) => ({
    action: button.id,
    label: button.label,
    side: button.side,
    required: button.required,
  })),
)
</script>

{#snippet end()}
  <button type="button" class="af-control af-control--ghost" data-testid="pause" aria-label={copy.current.play.pause} onclick={onPause}
    ><span aria-hidden="true">II</span></button
  >
{/snippet}

{#snippet body()}
  <div class="af-game-play__field">
    {#each hud as Hud, index (index)}
      <Hud />
    {/each}
  </div>
{/snippet}

{#snippet actions()}
  <TouchControls
    testId="touch-buttons"
    {buttons}
    onhold={onHold}
    onrelease={onRelease}
    stick={stick === undefined ? undefined : { label: copy.current.play.move }}
    onstick={stick?.onstick}
    onstickend={stick?.onstickend}
  />
{/snippet}

<div class="af-game-play" data-game-screen="play">
  {#if drag !== undefined}
    <CameraDragSurface tracker={drag} />
  {/if}
  {#if touching && swipe !== undefined}
    <SwipeSurface tracker={swipe} />
  {/if}
  <ScreenFrame arrangement="stack" testId="play-screen" {end} {body} actions={showButtons ? actions : undefined} />
</div>
