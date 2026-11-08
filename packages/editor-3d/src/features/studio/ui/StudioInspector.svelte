<!--
  The Studio's inspector (EDS.9a to EDS.9c): the fields of the mode the stage is in, over the one refusal line. Look is
  the figure, Pose the chosen handle, Animate the clip and its chosen key.
-->
<script lang="ts">
import type { StudioController } from '../studio-controller'
import ClipFields from './ClipFields.svelte'
import LookFields from './LookFields.svelte'
import PoseFields from './PoseFields.svelte'

const { controller }: { controller: StudioController } = $props()

// svelte-ignore state_referenced_locally
const viewState = controller.view.state
// svelte-ignore state_referenced_locally
const refusal = controller.refusal
</script>

<section class="inspector" aria-label="Studio fields" data-testid="studio-inspector">
  {#if $viewState.mode === 'look'}
    <LookFields {controller} />
  {:else if $viewState.mode === 'pose'}
    <PoseFields {controller} />
  {:else}
    <ClipFields {controller} />
  {/if}
  {#if $refusal !== undefined}
    <p class="refusal" role="alert" data-testid="studio-refusal">{$refusal}</p>
  {/if}
</section>

<style>
  .inspector {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .refusal {
    margin: 0;
    color: var(--color-state-bad);
  }
</style>
