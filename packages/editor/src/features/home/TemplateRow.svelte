<!--
  "Start a new project": one card for every template of every registered profile (plan ED2D.4c2a, decision 4). It
  draws the cards it is given and knows no profile. While a project is being made the cards stay and are disabled, so
  the page does not jump. A card is a 48 px or taller primary action.
-->
<script lang="ts">
import Pill from '../../shared/kit/widgets/Pill.svelte'
import type { TemplateCard } from './home-model'

interface Props {
  cards: readonly TemplateCard[]
  /** A project is being made (or another action is running). */
  busy: boolean
  oncreate: (profileId: string, templateId: string) => void
}

const { cards, busy, oncreate }: Props = $props()
const uid = $props.id()
</script>

<section class="templates" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`}>Start a new project</h2>
  <ul>
    {#each cards as card (card.key)}
      <li>
        <button type="button" disabled={busy} onclick={() => oncreate(card.profileId, card.id)}>
          <span class="label">{card.label}</span>
          {#if card.hint}<span class="hint">{card.hint}</span>{/if}
          {#if card.tagged}<span class="tag"><Pill>{card.profileLabel}</Pill></span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .templates {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    width: 100%;
    min-height: 5rem;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    text-align: left;
    cursor: pointer;
  }
  button:hover:enabled {
    border-color: var(--color-border-strong);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .label {
    font: var(--text-body-13-medium);
  }
  .hint {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .tag {
    margin-top: auto;
  }
</style>
