<!--
  One condition or action as a sentence with its fields under it, built from a `Piece`. A kind the table lacks is shown
  as a sentence and left alone. "Not" turns a condition round and back; Remove takes it out.
-->
<script lang="ts" generics="V">
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import type { Names, Piece } from './pieces/piece.ts'

const {
  piece,
  value,
  names,
  fallback,
  onnot,
  negated = false,
  onwrite,
  onremove,
}: {
  piece: Piece<V> | undefined
  value: V
  names: Names
  /** The sentence for a kind the table lacks. */
  fallback: string
  /** Present for a condition: turns it round, or back. */
  onnot?: (() => void) | undefined
  /** Whether the value is a "not" now, for the button's state. */
  negated?: boolean | undefined
  onwrite: (next: V) => void
  onremove?: (() => void) | undefined
} = $props()
const words = $derived(piece === undefined ? fallback : piece.words(value, names))
const fields = $derived(piece === undefined ? [] : piece.fields(value, names))
</script>

<li class="row">
  <p class="sentence">{words}</p>
  {#if piece === undefined}
    <p class="dim">The editor cannot change this one yet. It stays as it is.</p>
  {:else}
    {#each fields as field (field.key)}
      <FieldRow
        label={field.label}
        kind={field.kind}
        value={field.value}
        options={field.kind === 'choice' ? field.options : undefined}
        unit={field.kind === 'number' ? field.unit : undefined}
        min={field.kind === 'number' ? field.min : undefined}
        max={field.kind === 'number' ? field.max : undefined}
        step={field.kind === 'number' ? field.step : undefined}
        onchange={(next) => onwrite(piece.write(value, field.key, next))}
      />
    {/each}
  {/if}
  <div class="buttons">
    {#if onnot !== undefined && piece !== undefined}
      <button type="button" aria-pressed={negated} aria-label={`Not: ${words}`} onclick={onnot}>Not</button>
    {/if}
    {#if onremove !== undefined}<Button onclick={onremove} aria-label={`Remove: ${words}`}>Remove</Button>{/if}
  </div>
</li>

<style>
  .row {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
    list-style: none;
  }
  .sentence {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  button {
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
</style>
