<!--
  One project in the list: a tile with the project's initial in its
  kind's accent, the title with its badge, the kind and the file's size and age, and the path with the folder shortened
  before the file name. It draws a `HomeCard`, which each editor makes from its own list item. It is an option of the
  list's listbox, not a focusable control: the list owns the keys and the focus (`aria-activedescendant`).
  The tile is `CardTile`: the preview when it draws, else the initial.
-->
<script lang="ts">
import Pill from '../widgets/Pill.svelte'
import CardTile from './CardTile.svelte'
import { type HomeCard, modifiedLabel, sizeLabel, splitPath } from './project-browse'

interface Props {
  id: string
  card: HomeCard
  selected: boolean
  /** The time the age is told against. */
  now: number
  onpointerdown: (event: PointerEvent) => void
  onclick: () => void
  ondblclick: () => void
}

const { id, card, selected, now, onpointerdown, onclick, ondblclick }: Props = $props()

const path = $derived(splitPath(card.path))
</script>

<!-- The option takes pointer input only: the listbox owns focus and handles the same actions from the keyboard. -->
<!-- svelte-ignore a11y_interactive_supports_focus, a11y_click_events_have_key_events -->
<div
  {id}
  class="card"
  role="option"
  aria-selected={selected}
  style:--kind={`var(${card.accent ?? '--muted'})`}
  {onpointerdown}
  {onclick}
  {ondblclick}
>
  <CardTile {card} />
  <span class="text">
    <span class="head">
      <span class="title">{card.title}</span>
      {#if card.badge}<Pill tone={card.badge.tone}>{card.badge.text}</Pill>{/if}
    </span>
    <span class="meta">
      <Pill accent={card.accent === undefined ? undefined : '--kind'}>{card.kind}</Pill>
      <span class="stats">{sizeLabel(card.size)} · {modifiedLabel(card.mtime, now)}</span>
    </span>
    <span class="path" title={card.path}>
      {#if path.dir}<span class="dir">{path.dir}</span>{/if}<span class="file">{path.name}</span>
    </span>
  </span>
</div>

<style>
  .card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  @media (hover: hover) {
    .card:hover {
      border-color: var(--line-strong);
    }
  }
  .card[aria-selected='true'] {
    border-color: var(--cobalt);
    box-shadow: 0 0 0 1px var(--cobalt);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }
  .head,
  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
  }
  .title {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--text-title-15);
  }
  .stats {
    color: var(--muted);
    font: var(--text-mono-11);
  }
  .path {
    display: flex;
    min-width: 0;
    color: var(--muted);
    font: var(--text-mono-11);
  }
  .dir {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file {
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
