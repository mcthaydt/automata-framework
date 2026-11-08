<!--
  The Tuner's inspector: the chosen setting's label (or name), type, value, range, unit and what it does, whether it
  is kept, and (a setting with a scale is shown in its unit, as its row shows it, `tuner-display.ts`)
  why a table or a list is "Ask only". With nothing chosen it says how to choose.
-->
<script lang="ts">
import Button from '../../../../shared/kit/widgets/Button.svelte'
import { KEEP_TIP, shownName, shownNote } from '../tuner-content'
import type { TunerController } from '../tuner-controller'
import { shownBounds, shownValue } from '../tuner-display'

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
/** A number as the row shows it, with its unit. */
const inUnit = (value: number): string => {
  if (tunable === undefined) return String(value)
  return `${tunable.scale === undefined ? value : shownValue(tunable, value)}${tunable.unit ? ` ${tunable.unit}` : ''}`
}
const range = $derived(tunable === undefined ? undefined : shownBounds(tunable))
/** A scaled whole number is shown with decimals, so it is a number to the person reading it. */
const kindOf = (kind: string): string => (tunable?.scale !== undefined && kind === 'int' ? 'float' : kind)
const kindWord = (kind: string): string =>
  ({ int: 'whole number', float: 'number', boolean: 'on or off', string: 'text', other: 'table or list' })[
    kind
  ] ?? kind
</script>

<section class="inspector" aria-label="Setting" data-testid="tuner-inspector">
  {#if tunable === undefined}
    <p class="none">Tap a setting to see more.</p>
  {:else}
    <h2>{shownName(tunable)}</h2>
    <dl>
      <dt>Type</dt>
      <dd>{kindWord(kindOf(tunable.kind))}</dd>
      {#if tunable.editable}
        <dt>Value</dt>
        <dd>{typeof tunable.value === 'number' ? inUnit(tunable.value) : String(tunable.value)}</dd>
      {/if}
      {#if range?.min !== undefined && range.max !== undefined}
        <dt>Range</dt>
        <dd>{range.min} to {range.max}{tunable.unit ? ` ${tunable.unit}` : ''}</dd>
      {:else if tunable.editable && tunable.kind !== 'boolean' && tunable.kind !== 'string'}
        <dt>Range</dt>
        <dd>None</dd>
      {/if}
      {#if shownNote(tunable)}
        <dt>What it does</dt>
        <dd>{shownNote(tunable)}</dd>
      {/if}
    </dl>
    {#if !tunable.editable}
      <p class="none">A table or a list is changed with Ask, not here.</p>
    {:else}
      <Button aria-pressed={locked} title={KEEP_TIP} onclick={() => controller.toggleLock(tunable.name)}>
        {locked ? 'Kept' : 'Keep'}
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
