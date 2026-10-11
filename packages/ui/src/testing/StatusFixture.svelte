<!--
  The status overlays for the layout contracts (M1.6 spec §7, plan Task 11): the loader while
  assets arrive; the boot failure with the most words on its button (Continue without loading);
  an ErrorPanel with two ways forward, with a one-line message or a long one, and with three;
  and a final
  ErrorPanel (no way forward) with a long message. A failure is drawn over a screen with Back in
  its corner row, as a game would show it, so the contract can check Back stays reachable.
-->
<script lang="ts" module>
export type StatusShow = 'loader' | 'boot-failure' | 'error' | 'error-long' | 'error-three' | 'final-long'
</script>

<script lang="ts">
import ScreenFrame from '../layout/ScreenFrame.svelte'
import BootFailurePanel from '../status/BootFailurePanel.svelte'
import ErrorPanel from '../status/ErrorPanel.svelte'
import LoaderOverlay from '../status/LoaderOverlay.svelte'

const { show }: { show: StatusShow } = $props()
const none = (): void => undefined
// About 1000 characters, as the framework audit used: longer than any screen can show at once.
const SENTENCE =
  "Couldn't load your progress. The save on this device could not be read, and the copy kept " +
  'online did not answer in time. You can try again now, or go on without it for this run. '
const LONG = SENTENCE.repeat(6).trim()
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
  {:else if show === 'final-long'}
    <ErrorPanel code="unsupported" message={LONG} actions={[]} final />
  {:else if show === 'error-three'}
    <ErrorPanel
      code="progress"
      message="Couldn't load your progress."
      actions={[
        { id: 'retry', label: 'Try again', kind: 'primary', onSelect: none },
        { id: 'dismiss', label: 'Continue without loading', kind: 'secondary', onSelect: none },
        { id: 'help', label: 'Get help', kind: 'secondary', onSelect: none },
      ]}
    />
  {:else}
    <ErrorPanel
      code="progress"
      message={show === 'error-long' ? LONG : "Couldn't load your progress."}
      actions={[
        { id: 'retry', label: 'Try again', kind: 'primary', onSelect: none },
        { id: 'dismiss', label: 'Continue without loading', kind: 'secondary', onSelect: none },
      ]}
    />
  {/if}
{/if}
