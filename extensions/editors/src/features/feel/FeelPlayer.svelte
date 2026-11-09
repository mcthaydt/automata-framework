<!--
  The stage with the player's settings: what a player who turns on less flashing, switches rumble off or sets the
  strength lower would feel. They change only the preview, never the file.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import FeelStage from './FeelStage.svelte'
import { eventWords } from './feel-model.ts'
import type { FeelSession } from './feel-session.svelte.ts'
import { alsoPlays } from './feel-stage.ts'

const { session }: { session: FeelSession } = $props()
const entries = $derived(session.content?.entry ?? [])
const index = $derived(typeof session.chosen === 'number' ? session.chosen : undefined)
const chosen = $derived(index === undefined ? undefined : entries[index])
const others = $derived(index === undefined ? [] : alsoPlays(entries, index))
const STRENGTHS = [
  { value: '1', label: 'Full' },
  { value: '0.5', label: 'Half' },
  { value: '0', label: 'Off' },
] as const
</script>

<!-- Two children of the canvas's grid, so a narrow canvas can put the stage first and keep it in view while a field changes. -->
<section class="stage-part" aria-label="Feel it">
  <FeelStage
    content={session.content}
    on={chosen?.on}
    settings={session.preview}
    reduced={session.preview.reduced}
    outputs={session.outputs}
    replay={session.replay}
  />
  <div class="actions"><Button onclick={() => (session.replay += 1)}>Play again</Button></div>
  {#if others.length > 0}
    <p class="also">
      Also plays:
      {#each others as place, at (place)}
        <button type="button" class="link" onclick={() => (session.chosen = place)}>{eventWords(entries[place]?.on ?? '')}</button
        >{at < others.length - 1 ? ', ' : ''}
      {/each}
    </p>
  {/if}
</section>
<section class="settings-part" aria-label="What the player sets">
  <fieldset>
    <legend>What the player sets</legend>
    <label class="check">
      <input
        type="checkbox"
        checked={session.preview.reduceFlashing}
        onchange={(event) => (session.preview = { ...session.preview, reduceFlashing: event.currentTarget.checked })}
      />
      Less flashing
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={session.preview.haptics}
        onchange={(event) => (session.preview = { ...session.preview, haptics: event.currentTarget.checked })}
      />
      Rumble
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={session.preview.reduced}
        onchange={(event) => (session.preview = { ...session.preview, reduced: event.currentTarget.checked })}
      />
      Reduce motion
    </label>
    <label class="pick">
      Strength
      <select
        value={String(session.preview.intensity)}
        onchange={(event) =>
          (session.preview = { ...session.preview, intensity: Number(event.currentTarget.value) as 0 | 0.5 | 1 })}
      >
        {#each STRENGTHS as strength (strength.value)}<option value={strength.value}>{strength.label}</option>{/each}
      </select>
    </label>
    <p class="note">Only changes this preview.</p>
  </fieldset>
</section>

<style>
  .stage-part,
  .settings-part {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    min-width: 0;
  }
  .stage-part {
    grid-area: stage;
  }
  .settings-part {
    grid-area: settings;
  }
  /* Stacked, the stage stays at the top of the canvas while a field changes, when the screen is tall enough for both. */
  @media (min-height: 640px) {
    .stage-part {
      position: sticky;
      z-index: 1;
      top: calc(-1 * var(--space-5));
      padding-block: var(--space-2);
      background: var(--color-bg-app);
    }
  }
  @container (min-width: 560px) {
    .stage-part {
      position: static;
      padding-block: 0;
    }
  }
  .actions {
    display: flex;
  }
  .also,
  .note {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .link {
    min-height: var(--size-hit);
    padding: 0 var(--space-1);
    border: 0;
    background: transparent;
    color: var(--color-accent-default);
    font: var(--text-body-13);
    cursor: pointer;
  }
  fieldset {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
  }
  legend {
    padding: 0 var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .check,
  .pick {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  select {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
