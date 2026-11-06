<!--
  One level on Home: a big tile (its preview, else its initial), its name, "Changed 7 minutes ago" and, only when
  there is something to say, its problems. Tapping the card opens the level. Everything else a person does with it
  (Open, Duplicate, Details, Delete) is in its More menu, so there is no third column to look for.

  The card's open button is one stop of the list's roving focus: only the selected card is in the tab order, and the
  list (`LevelList`) moves the focus with the arrow keys. Focusing a card selects it, so the keys and the menu always
  act on the card in front of the person. While another action runs the card stays where it is and does nothing.
-->
<script lang="ts">
import CardTile from '../../shared/kit/home/CardTile.svelte'
import type { HomeCard } from '../../shared/kit/home/project-browse'
import Icon from '../../shared/kit/icons/Icon.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import Pill from '../../shared/kit/widgets/Pill.svelte'
import { changedLabel } from './home-model'

/** What the More menu does: each id is an action of Home's controller on this card. */
export type CardAction = 'open' | 'duplicate' | 'details' | 'delete'

interface Props {
  card: HomeCard
  selected: boolean
  /** The time "Changed …" is told against. */
  now: number
  busy: boolean
  /** The menu is a bottom sheet on a phone, a popover elsewhere. */
  menu: 'popover' | 'sheet'
  onfocus: () => void
  onaction: (action: CardAction) => void
}

const { card, selected, now, busy, menu, onfocus, onaction }: Props = $props()

const ITEMS = [
  { id: 'open', label: 'Open' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'details', label: 'Details' },
  'separator',
  { id: 'delete', label: 'Delete…' },
] as const
</script>

<li class="card" data-selected={selected} style:--kind={card.accent === undefined ? undefined : `var(${card.accent})`}>
  <button
    type="button"
    class="open"
    tabindex={selected ? 0 : -1}
    data-path={card.path}
    aria-disabled={busy}
    {onfocus}
    onclick={() => {
      if (!busy) onaction('open')
    }}
  >
    <CardTile {card} size={72} />
    <span class="text">
      <span class="title">{card.title}</span>
      <span class="changed">{changedLabel(card.mtime, now)}</span>
    </span>
    {#if card.badge}<Pill tone={card.badge.tone}>{card.badge.text}</Pill>{/if}
  </button>
  <Menu
    label={`More for ${card.title}`}
    items={ITEMS}
    presentation={menu}
    disabled={busy}
    onselect={(id) => {
      onfocus()
      onaction(id as CardAction)
    }}
  >
    {#snippet trigger()}<Icon name="more" />{/snippet}
  </Menu>
</li>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-right: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--paper);
  }
  .card[data-selected='true'] {
    border-color: var(--cobalt);
  }
  @media (hover: hover) {
    .card:hover {
      border-color: var(--line-strong);
    }
  }
  .open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
    min-height: var(--size-primary);
    padding: var(--space-3);
    border: 0;
    border-radius: var(--radius-lg);
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    -webkit-touch-callout: none;
  }
  .open[aria-disabled='true'] {
    cursor: default;
  }
  .open:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--text-title-15);
  }
  .changed {
    color: var(--muted);
    font: var(--text-body-13);
  }
</style>
