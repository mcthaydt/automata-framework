<!--
  A 3D play screen's touch input for the DOM and layout tests (M4.12): the camera drag surface under a frame with
  Pause in its corner and the overlay in its actions row, the move stick at the start and two buttons at the end.
  `with-bar` puts an ActionBar above the overlay and an unrequired button beside the required one (D-a): where they
  do not all fit at the primary size, the stick and the required button stay.
-->
<script lang="ts">
import ActionBar from '../layout/ActionBar.svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import CameraDragSurface from '../touch/CameraDragSurface.svelte'
import type { DragTracker } from '../touch/camera-drag-surface'
import TouchControls from '../touch/TouchControls.svelte'

const IDLE: DragTracker = {
  down: () => false,
  move: () => undefined,
  up: () => undefined,
  cancel: () => undefined,
}

const { tracker = IDLE, show = 'default' }: { tracker?: DragTracker; show?: 'default' | 'with-bar' } =
  $props()
const none = (): void => undefined
</script>

<CameraDragSurface {tracker} />
<ScreenFrame arrangement="stack">
  {#snippet end()}
    <button type="button" class="af-control af-control--ghost" data-testid="pause" aria-label="Pause" onclick={none}
      ><span aria-hidden="true">II</span></button
    >
  {/snippet}
  {#snippet body()}<p>Play</p>{/snippet}
  {#snippet actions()}
    <div style="display: grid; gap: 8px">
      {#if show === 'with-bar'}
        <ActionBar
          actions={[
            { id: 'bar-ready', label: 'Ready', kind: 'primary', onSelect: none },
            { id: 'bar-leave', label: 'Leave the race', shortLabel: 'Leave', kind: 'secondary', onSelect: none },
          ]}
        />
      {/if}
      <TouchControls
        stick={{ label: 'Move' }}
        buttons={[
          { action: 'lock', label: 'Lock', side: 'end' },
          { action: 'attack', label: 'Attack', side: 'end', required: true },
        ]}
        onhold={none}
        onrelease={none}
      />
    </div>
  {/snippet}
</ScreenFrame>
