<!-- Asks a new cutscene's name and length, the only two things it needs; it starts with one camera step. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session, oncancel }: { session: SequenceSession; oncancel?: (() => void) | undefined } = $props()
let name = $state('')
let length = $state(10)
let refusal = $state<string | undefined>()

async function add(): Promise<void> {
  const outcome = await session.addCutscene(name, length)
  refusal = outcome.ok ? undefined : outcome.message
  if (outcome.ok) {
    name = ''
    oncancel?.()
  }
}
</script>

<form
  onsubmit={(submitted) => {
    submitted.preventDefault()
    void add()
  }}
>
  <label for="sequence-name">What is it called?</label>
  <input id="sequence-name" bind:value={name} placeholder="Opening" />
  <label for="sequence-length">How long is it, in seconds?</label>
  <input id="sequence-length" type="number" inputmode="decimal" min="1" step="0.5" bind:value={length} />
  {#if refusal !== undefined}<p class="bad" role="alert">{refusal}</p>{/if}
  <div class="actions">
    {#if oncancel !== undefined}<Button variant="quiet" onclick={oncancel}>Cancel</Button>{/if}
    <Button variant="primary" disabled={name.trim() === ''} onclick={() => void add()}>Add</Button>
  </div>
</form>

<style>
  form {
    display: grid;
    gap: var(--space-2);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  input {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .bad {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
