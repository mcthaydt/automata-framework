<!--
  The status overlays for the layout contracts (M1.6 spec §7, plan Task 11): the loader while
  assets arrive; the boot failure with the most words on its button (Continue without loading);
  and an ErrorPanel with two ways forward. A failure is drawn over a screen with Back in its corner
  row, as a game would show it, so the panel is checked against the corner row too.
-->
<script lang="ts">
import ScreenFrame from '../layout/ScreenFrame.svelte'
import BootFailurePanel from '../status/BootFailurePanel.svelte'
import ErrorPanel from '../status/ErrorPanel.svelte'
import LoaderOverlay from '../status/LoaderOverlay.svelte'

const { show }: { show: 'loader' | 'boot-failure' | 'error' } = $props()
const none = (): void => undefined
</script>

{#if show === 'loader'}
  <LoaderOverlay label="Loading the game" progress={0.4} slow slowLabel="This is taking a while." />
{:else}
  <ScreenFrame arrangement="stack" back={none} backLabel="Back">
    {#snippet body()}<p>Choose a level</p>{/snippet}
  </ScreenFrame>
  {#if show === 'boot-failure'}
    <BootFailurePanel
      failure={{ _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.get' }}
      hostKind="standalone"
      onRetry={none}
      onContinue={none}
      onExit={none}
    />
  {:else}
    <ErrorPanel
      code="progress"
      message="Couldn't load your progress."
      actions={[
        { id: 'retry', label: 'Try again', kind: 'primary', onSelect: none },
        { id: 'dismiss', label: 'Continue without loading', kind: 'secondary', onSelect: none },
      ]}
    />
  {/if}
{/if}
