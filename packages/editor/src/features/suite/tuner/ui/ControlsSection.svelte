<!--
  The Tuner's Controls section: what a new player starts with, one card per action. Each card has the action's name
  (editable), its keys as chips by the names the game shows a player (an arrow is "←", KeyA is "A"), the pad's buttons
  the same way but marked "Pad" so a key and a pad button are never alike, "Add key" and "Show a button on touch screens". Add key says "Press a key on your keyboard." and waits
  for the next key; Cancel ends it with no edit, since a phone has no Escape. Tab is never taken (it moves focus), and
  Escape only ends the wait. Players still rebind in the game's Settings; this changes the starting point.
-->
<script lang="ts">
import Button from '../../../../shared/kit/widgets/Button.svelte'
import { type ControlRow, readControls } from '../controls-section'
import type { TunerController } from '../tuner-controller'

const { controller }: { controller: TunerController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision

const read = $derived.by(() => {
  void $revision
  return controller.controls()
})

/** The action waiting for a key, if any. */
let listening = $state<string | undefined>(undefined)

function onKey(event: KeyboardEvent): void {
  const id = listening
  if (id === undefined) return
  // Tab moves focus (so a person can reach Cancel), and Escape only ends the wait.
  if (event.code === 'Tab') return
  event.preventDefault()
  event.stopPropagation()
  listening = undefined
  if (event.code === 'Escape' || event.code === '' || event.code === 'Unidentified') return
  void controller.addControlKey(id, event.code)
}

$effect(() => {
  if (listening === undefined) return
  window.addEventListener('keydown', onKey, true)
  return () => window.removeEventListener('keydown', onKey, true)
})

const rename = (row: ControlRow, event: Event & { currentTarget: HTMLInputElement }): void => {
  const next = event.currentTarget.value.trim()
  if (next === row.label) return
  void controller.setControlLabel(row.id, next)
}
</script>

{#if read !== undefined}
  <section class="controls" aria-label="Controls" data-testid="tuner-controls">
    <h3>Controls</h3>
    <p class="hint">What a new player starts with. Players can change their own in Settings.</p>
    {#if 'problem' in read}
      <p class="problem" role="alert">{read.problem}</p>
    {:else}
      {#each read.rows as row (row.id)}
        <div class="row" role="group" aria-label={row.label} data-testid={`controls-row-${row.id}`}>
          <label class="name">
            <span class="label">Name</span>
            <input
              type="text"
              aria-label="Name"
              value={row.label}
              onchange={(event) => rename(row, event)}
              onkeydown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </label>
          <ul class="chips" aria-label={`Keys for ${row.label}`}>
            {#each row.keys as key (key.code)}
              <li class="chip">
                <span>{key.label}</span>
                <button
                  type="button"
                  class="drop"
                  aria-label={`Remove ${key.label} from ${row.label}`}
                  onclick={() => void controller.removeControlKey(row.id, key.code)}>×</button
                >
              </li>
            {/each}
            {#each row.pads as pad (pad.button)}
              <li class="chip pad"><span>Pad {pad.label}</span></li>
            {/each}
          </ul>
          {#if listening === row.id}
            <div class="listen" role="status">
              <p>Press a key on your keyboard.</p>
              <Button onclick={() => (listening = undefined)}>Cancel</Button>
            </div>
          {:else}
            <Button onclick={() => (listening = row.id)}>Add key</Button>
          {/if}
          <button
            type="button"
            role="switch"
            class="toggle"
            aria-checked={row.touch}
            onclick={() => void controller.setControlTouch(row.id, !row.touch)}
            >Show a button on touch screens</button
          >
        </div>
      {/each}
    {/if}
  </section>
{/if}

<style>
  .controls {
    display: grid;
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    font: var(--text-title-15);
  }
  .hint,
  .problem {
    margin: 0;
    color: var(--color-text-dim);
  }
  .problem {
    color: var(--color-state-bad);
  }
  .row {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
  }
  .name {
    display: grid;
    gap: var(--space-1);
  }
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  input {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: inherit;
    font: inherit;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--bg);
    font: var(--text-body-13-medium);
  }
  .pad {
    color: var(--color-text-dim);
  }
  .drop {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .listen {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .listen p {
    margin: 0;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: inherit;
    font: var(--text-body-13-medium);
    text-align: left;
    cursor: pointer;
  }
  .toggle[aria-checked='true'] {
    border-color: var(--color-accent-default);
    background: var(--bg);
  }
</style>
