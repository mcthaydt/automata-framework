<!--
  The fields of the chosen step, in words, and the scene's own (its length, lens, and whether it ends the game) when no
  step is chosen. On a phone it is a sheet over the bottom of the timeline while a step is chosen.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { type KeyField, keyFields, sceneFields } from './key-fields.ts'
import type { SequenceSession } from './sequence-session.svelte.ts'
import { TRACK_WORDS } from './tracks.ts'

const { session }: { session: SequenceSession } = $props()
const script = $derived(session.script)
const selection = $derived(session.selection)
const fields = $derived(
  script === undefined || selection === undefined
    ? []
    : keyFields(script, selection.track, selection.index, session.names),
)
const shown = $derived(fields.filter((entry) => entry.more !== true))
const more = $derived(fields.filter((entry) => entry.more === true))
const scene = $derived(script === undefined ? [] : sceneFields(script))
const here = $derived(
  selection === undefined
    ? []
    : session.problems.filter((found) => found.track === selection.track && found.index === selection.index),
)
const refusal = $derived(session.current?.message)
let element: HTMLElement | undefined = $state()

// A step chosen in the timeline above puts its fields on screen, so a person on a phone sees what tapping did.
$effect(() => {
  if (selection !== undefined) element?.scrollIntoView?.({ block: 'nearest' })
})

function change(entry: KeyField, value: string | number): void {
  if (entry.field.key === 'duration') void session.setLength(Number(value))
  else void session.setField(entry, value, `Change ${entry.field.label.toLowerCase()}`)
}
</script>

{#snippet row(entry: KeyField)}
  <FieldRow
    label={entry.field.label}
    kind={entry.field.kind}
    value={entry.field.value}
    options={entry.field.kind === 'choice' ? entry.field.options : undefined}
    unit={entry.field.kind === 'number' ? entry.field.unit : undefined}
    min={entry.field.kind === 'number' ? entry.field.min : undefined}
    max={entry.field.kind === 'number' ? entry.field.max : undefined}
    step={entry.field.kind === 'number' ? entry.field.step : undefined}
    problem={entry.problem}
    onchange={(value) => change(entry, value)}
  />
{/snippet}

<section class="inspector" class:sheet={selection !== undefined} aria-label="This step" bind:this={element}>
  {#if refusal !== undefined}<p class="bad" role="alert">{refusal}</p>{/if}
  {#if selection === undefined}
    <h3>The scene</h3>
    {#each scene as entry (entry.field.key)}{@render row(entry)}{/each}
    {#if session.shortening !== undefined}
      <div class="ask" role="alertdialog" aria-label="Shorten the scene">
        <p>
          {session.shortening.dropped === 1 ? '1 step is' : `${String(session.shortening.dropped)} steps are`} after the new
          end. Remove {session.shortening.dropped === 1 ? 'it' : 'them'}?
        </p>
        <div class="actions">
          <Button variant="quiet" onclick={() => (session.shortening = undefined)}>Keep the length</Button>
          <Button onclick={() => void session.confirmLength()}>Remove them</Button>
        </div>
      </div>
    {/if}
    <p class="hint">Tap a step in the timeline to change it.</p>
  {:else}
    <h3>{TRACK_WORDS[selection.track]}</h3>
    {#each here as found (found.words)}<p class="bad" role="status">{found.words}</p>{/each}
    {#each shown as entry (entry.field.key)}{@render row(entry)}{/each}
    {#if more.length > 0}
      <details>
        <summary>More</summary>
        {#each more as entry (entry.field.key)}{@render row(entry)}{/each}
      </details>
    {/if}
    <div class="actions">
      <Button onclick={() => void session.moveToPlayhead()}>Move to the playhead</Button>
      <Button onclick={() => void session.removeSelected()}>Remove this step</Button>
      <Button variant="quiet" onclick={() => session.select(undefined)}>Done</Button>
    </div>
  {/if}
</section>

<style>
  .inspector {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    min-width: 0;
  }
  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .hint {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .bad {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  details {
    display: grid;
    gap: var(--space-3);
  }
  summary {
    min-height: var(--size-hit);
    color: var(--color-text-dim);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .ask {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
  }
  /* Stacked, the step's fields sit under the timeline as ordinary page, never over it (a sticky sheet hid the labels
     under the timeline's pinned row names); choosing a step scrolls them into view. */
  @media (max-width: 819px) {
    .sheet {
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border-default);
    }
  }
</style>
