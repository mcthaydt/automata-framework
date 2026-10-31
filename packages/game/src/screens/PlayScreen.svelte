<!--
  The default play screen (DX spec §7): the game shows through; the frame holds the corner Pause and, while the
  player uses touch, the input map's touch input. In touch mode `buttons` that is the ui `TouchControls` along the
  foot (sticky, several thumbs at once, M4.3); in touch mode `swipe` it is a `SwipeSurface` over the whole screen,
  under Pause, feeding the swipe tracker.
-->
<script lang="ts">
import {
  CameraDragSurface,
  type DragTracker,
  type InputMethodTracker,
  type PointerTracker,
  ScreenFrame,
  SwipeSurface,
  TouchControls,
  type UiComponent,
} from '@mcthaydt/automata-ui'
import type { TouchButton } from '../input/keys.ts'
import type { LiveScreensCopy } from './screens-copy.svelte.ts'

interface Props {
  onPause: () => void
  /** The screens' words in the player's language (DX.2d). */
  copy: LiveScreensCopy
  tracker: InputMethodTracker
  touchButtons: readonly TouchButton[]
  onHold: (id: string) => void
  onRelease: (id: string) => void
  /** The swipe tracker, in touch mode `swipe`; none in mode `buttons`. */
  swipe?: PointerTracker | undefined
  /** The extensions' `hud.overlay` components, drawn over the game inside the visible region (M4.7). */
  hud?: readonly UiComponent[] | undefined
  /** The camera-drag tracker, when the input map binds `camera-drag` (M4 spec §16.4); none draws no surface. */
  drag?: DragTracker | undefined
  /** The touch stick, when the input map asks for it (M4 spec §17.1): its vector and its release. */
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
  copy,
  drag,
  stick,
}: Props = $props()

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
