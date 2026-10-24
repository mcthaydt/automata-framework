<!--
  The touch buttons for the layout contracts (M4.3, M4.7): a play screen's frame with Pause in its corner and the
  buttons in the frame's actions row, as the default play screen puts them. `with-bar` puts an ActionBar above them
  and four buttons, the movement and Drop required and an Emote not, as a game's own screen might (D-a): where they
  do not all fit at the primary size, only the required ones show.
-->
<script lang="ts">
import ActionBar from '../layout/ActionBar.svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import TouchControls from '../touch/TouchControls.svelte'

const { show = 'default' }: { show?: 'default' | 'with-bar' } = $props()
const none = (): void => undefined
</script>

<ScreenFrame arrangement="stack" back={none} backLabel="Pause">
  {#snippet body()}<p>Play</p>{/snippet}
  {#snippet actions()}
    {#if show === 'with-bar'}
      <div style="display: grid; gap: 8px">
        <ActionBar
          actions={[
            { id: 'bar-ready', label: 'Ready', kind: 'primary', onSelect: none },
            { id: 'bar-leave', label: 'Leave the race', shortLabel: 'Leave', kind: 'secondary', onSelect: none },
          ]}
        />
        <TouchControls
          buttons={[
            { action: 'touch-left', label: '←', ariaLabel: 'Move left', required: true },
            { action: 'touch-right', label: '→', ariaLabel: 'Move right', required: true },
            { action: 'touch-emote', label: 'Wave hello', side: 'end' },
            { action: 'touch-drop', label: 'Drop', side: 'end', required: true },
          ]}
          onhold={none}
          onrelease={none}
        />
      </div>
    {:else}
      <TouchControls
        buttons={[
          { action: 'touch-left', label: '←', ariaLabel: 'Move left' },
          { action: 'touch-right', label: '→', ariaLabel: 'Move right' },
          { action: 'touch-drop', label: 'Drop', side: 'end' },
        ]}
        onhold={none}
        onrelease={none}
      />
    {/if}
  {/snippet}
</ScreenFrame>
