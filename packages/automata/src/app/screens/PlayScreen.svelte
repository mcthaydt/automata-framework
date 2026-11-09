<!--
  The default play screen: the game shows through; the frame holds the corner Pause and, while the
  player uses touch, the input map's touch input. In touch mode `buttons` that is the ui `TouchControls` along the
  foot (sticky, several thumbs at once); in touch mode `swipe` it is a `SwipeSurface` over the whole screen,
  under Pause, feeding the swipe tracker.

  A phone held sideways has an empty bar each side of the fitted level. There the buttons stand in the bars, a column
  each side, so none covers the level. Where a bar is too narrow to hold a button and a gap each side, where a column
  would be taller than the screen (a large text size) or where a stick is drawn, the row along the foot stays.
-->
<script lang="ts">
import type { TouchButton } from '../../features/input/keys.ts'
import { type InputMethodTracker } from '../../shared/ui/browser/input-method.svelte'
import { publishedSideBarRoom, TOUCH_BAR_GAP } from '../../shared/ui/geometry/side-bars'
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

// The bars change with the view, not with anything this screen owns: the renderer writes them on the root.
const root = typeof document === 'undefined' ? undefined : document.documentElement
let room = $state(root === undefined ? 0 : publishedSideBarRoom(root))
let viewHeight = $state(typeof window === 'undefined' ? 0 : window.innerHeight)
let textScale = $state(1)
$effect(() => {
  if (root === undefined) return
  const read = (): void => {
    room = publishedSideBarRoom(root)
    viewHeight = window.innerHeight
    textScale = Number.parseFloat(root.style.getPropertyValue('--af-scale')) || 1
  }
  const watch = new MutationObserver(read)
  watch.observe(root, { attributes: true, attributeFilter: ['style'] })
  window.addEventListener('resize', read)
  read()
  return () => {
    watch.disconnect()
    window.removeEventListener('resize', read)
  }
})

/** The tallest column: the side with the most buttons, each 1.5 x the primary size, with a gap between. */
const tallestColumn = $derived.by(() => {
  const start = touchButtons.filter((button) => (button.side ?? 'start') === 'start').length
  const tallest = Math.max(1, start, touchButtons.length - start)
  return tallest * 48 * textScale * 1.5 + (tallest - 1) * TOUCH_BAR_GAP
})
/** What a column may use: the view less the corner row (Pause) above it and a gutter above and below. */
const columnRoom = $derived(viewHeight - 48 * textScale - 3 * 16)
const inBars = $derived(
  showButtons &&
    stick === undefined &&
    room >= 48 * textScale + 2 * TOUCH_BAR_GAP &&
    tallestColumn <= columnRoom,
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
    placement={inBars ? 'bars' : 'foot'}
    barRoom={room}
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
