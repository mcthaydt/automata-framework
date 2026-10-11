<!--
  The boot overlays for the layout contracts (M1.6 plan Task 11): the loader while assets arrive,
  or the boot failure with the most words on its button (Continue without loading).
-->
<script lang="ts">
import BootFailurePanel from '../status/BootFailurePanel.svelte'
import LoaderOverlay from '../status/LoaderOverlay.svelte'

const { show }: { show: 'loader' | 'error' } = $props()
const none = (): void => undefined
</script>

{#if show === 'loader'}
  <LoaderOverlay label="Loading the game" progress={0.4} slow slowLabel="This is taking a while." />
{:else}
  <BootFailurePanel
    failure={{ _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.get' }}
    hostKind="standalone"
    onRetry={none}
    onContinue={none}
    onExit={none}
  />
{/if}
