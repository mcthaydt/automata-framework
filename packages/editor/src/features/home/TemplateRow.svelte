<!--
  The templates a new level can start from, one big card each ("Platformer: jump between platforms"), for every
  template of every registered profile. It draws the cards it is given and knows no profile; the profile's name is on a
  card only when two profiles' templates share the sheet. While a level is being made the cards stay and wait, so the
  sheet does not jump. Each card is a 48 px or taller target.
-->
<script lang="ts">
import Pill from '../../shared/kit/widgets/Pill.svelte'
import type { TemplateCard } from './home-model'

interface Props {
  cards: readonly TemplateCard[]
  /** A level is being made (or another action is running). */
  busy: boolean
  oncreate: (profileId: string, templateId: string) => void
}

const { cards, busy, oncreate }: Props = $props()
</script>

<ul aria-label="Templates">
  {#each cards as card (card.key)}
    <li>
      <button type="button" disabled={busy} onclick={() => oncreate(card.profileId, card.id)}>
        <span class="tile" aria-hidden="true">{[...card.label][0] ?? ''}</span>
        <span class="text">
          <span class="label">{card.label}</span>
          {#if card.hint}<span class="hint">{card.hint}</span>{/if}
        </span>
        {#if card.tagged}<Pill>{card.profileLabel}</Pill>{/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--size-primary);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--paper);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  button:hover:enabled {
    border-color: var(--line-strong);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cobalt) 14%, var(--paper));
    color: var(--cobalt);
    font: var(--text-display-20);
  }
  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .label {
    font: var(--text-title-15);
  }
  .hint {
    color: var(--muted);
    font: var(--text-body-13);
  }
</style>
