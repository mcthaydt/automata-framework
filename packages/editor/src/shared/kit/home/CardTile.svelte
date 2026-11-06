<!--
  A project's tile: its preview picture when the card has one and it draws, else the title's first letter in the
  kind's accent. Both editors' cards show it. The picture is decorative (`alt=""`), since the card's title names the
  project. `size` is the tile's side in px; the parent sets `--kind` to the accent.
-->
<script lang="ts">
import { untrack } from 'svelte'
import type { HomeCard } from './project-browse'

interface Props {
  card: HomeCard
  size?: number
}

const { card, size = 48 }: Props = $props()

let thumbnail = $state<string | undefined>(undefined)
// The preview's key names what it draws, so the tile redraws when the key changes and only then: a list that is
// mapped again makes new cards with the same keys.
const previewKey = $derived(card.preview?.key)
$effect(() => {
  const key = previewKey
  const preview = untrack(() => card.preview)
  thumbnail = undefined
  if (key === undefined || preview === undefined) return
  let current = true
  void preview.draw().then((url) => {
    if (current) thumbnail = url
  })
  return () => {
    current = false
  }
})
</script>

<span class="tile" aria-hidden="true" style:--tile={`${size}px`}>
  {#if thumbnail}<img src={thumbnail} alt="" />{:else}{[...card.title][0]?.toUpperCase() ?? ''}{/if}
</span>

<style>
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--tile);
    height: var(--tile);
    border: 1px solid color-mix(in srgb, var(--kind, var(--muted)) 55%, transparent);
    border-radius: var(--edge-sm);
    background: color-mix(in srgb, var(--kind, var(--muted)) 16%, var(--charcoal));
    color: var(--kind, var(--muted));
    font: var(--text-display-20);
    overflow: hidden;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }
</style>
