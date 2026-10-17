<!--
  The touch buttons for the layout contracts (M4.3): a play screen's frame with Pause in its corner and three
  buttons, two on the start side and one on the end, in the frame's actions row as the default play screen puts
  them. Where the overlay sits around corner controls and the host's strip is M4.7's rule.
-->
<script lang="ts">
import ScreenFrame from '../layout/ScreenFrame.svelte'
import TouchControls from '../touch/TouchControls.svelte'

const none = (): void => undefined
</script>

<ScreenFrame arrangement="stack" back={none} backLabel="Pause">
  {#snippet body()}<p>Play</p>{/snippet}
  {#snippet actions()}
    <TouchControls
      buttons={[
        { action: 'touch-left', label: '←', ariaLabel: 'Move left' },
        { action: 'touch-right', label: '→', ariaLabel: 'Move right' },
        { action: 'touch-drop', label: 'Drop', side: 'end' },
      ]}
      onhold={none}
      onrelease={none}
    />
  {/snippet}
</ScreenFrame>
