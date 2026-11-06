<!--
  The Tuner's inspector: the chosen tunable's name, kind, value, bounds, unit and note, whether it is locked, and
  why a table or a list is "Ask only". With nothing chosen it says how to choose.
-->
<script lang="ts">
import Button from '../../../../shared/kit/widgets/Button.svelte'
import type { TunerController } from '../tuner-controller'

const { controller }: { controller: TunerController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const selected = controller.selected

const tunable = $derived.by(() => {
  void $revision
  const read = controller.all()
  return 'tunables' in read ? read.tunables.find((entry) => entry.name === $selected) : undefined
})
const locked = $derived.by(() => {
  void $revision
  return $selected === undefined ? false : controller.isLocked($selected)
})
const kindWord = (kind: string): string =>
  ({ int: 'whole number', float: 'number', boolean: 'on or off', string: 'text', other: 'table or list' })[
    kind
  ] ?? kind
</script>

<section class="inspector" aria-label="Tunable" data-testid="tuner-inspector">
  {#if tunable === undefined}
    <p class="none">Choose a tunable to see its bounds and note.</p>
  {:else}
    <h2>{tunable.name}</h2>
    <dl>
      <dt>Kind</dt>
      <dd>{kindWord(tunable.kind)}</dd>
      {#if tunable.editable}
        <dt>Value</dt>
        <dd>{String(tunable.value)}{tunable.unit ? ` ${tunable.unit}` : ''}</dd>
      {/if}
      {#if tunable.min !== undefined && tunable.max !== undefined}
        <dt>Bounds</dt>
        <dd>{tunable.min} to {tunable.max}{tunable.step !== undefined ? `, step ${tunable.step}` : ''}</dd>
      {:else if tunable.editable && tunable.kind !== 'boolean' && tunable.kind !== 'string'}
        <dt>Bounds</dt>
        <dd>None</dd>
      {/if}
      {#if tunable.note}
        <dt>Note</dt>
        <dd>{tunable.note}</dd>
      {/if}
    </dl>
    {#if !tunable.editable}
      <p class="none">A table or a list is changed with Ask, not here.</p>
    {:else}
      <Button aria-pressed={locked} onclick={() => controller.toggleLock(tunable.name)}>
        {locked ? 'Unlock' : 'Lock'}
      </Button>
    {/if}
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
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-3);
    margin: 0;
  }
  dt {
    color: var(--color-text-dim);
  }
  dd {
    margin: 0;
  }
  .none {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
