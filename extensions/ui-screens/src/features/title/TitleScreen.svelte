<!--
  @component
  The title screen: the game's name, one primary Play and any further actions the game adds (Settings, Credits), on core's
  ScreenFrame and ActionBar. Play takes focus on entry. A game with saves keeps core's default title, which lists the slots; add
  that here by copying the slot list from `@automata/framework`'s title when you need it.
-->
<script lang="ts">
import { ActionBar, ScreenFrame } from '@automata/framework'
import { onMount } from 'svelte'

export interface TitleAction {
  readonly id: string
  readonly label: string
  /** What the action says when the bar is narrow. */
  readonly shortLabel?: string | undefined
}

interface Props {
  title: string
  /** Core's `ScreensCopy['title']`. */
  copy: { readonly play: string }
  onPlay: () => void
  /** The game's further actions, after Play. */
  extra?: readonly TitleAction[] | undefined
  onAction?: ((id: string) => void) | undefined
}

const { title, copy, onPlay, extra = [], onAction }: Props = $props()

const bar = $derived([
  { id: 'play', label: copy.play, kind: 'primary' as const, onSelect: onPlay },
  ...extra.map((action) => ({
    id: action.id,
    label: action.label,
    shortLabel: action.shortLabel,
    kind: 'secondary' as const,
    onSelect: () => onAction?.(action.id),
  })),
])

let root = $state<HTMLElement | undefined>(undefined)
onMount(() => root?.querySelector<HTMLElement>('[data-kind="primary"]')?.focus())
</script>

{#snippet body()}
  <div class="title__body">
    <h1 class="title__name">{title}</h1>
  </div>
{/snippet}

{#snippet actions()}
  <ActionBar actions={bar} />
{/snippet}

<div bind:this={root} class="title" data-game-screen="title">
  <ScreenFrame arrangement="stack" testId="title-screen" {body} {actions} />
</div>

<style>
  .title__body {
    display: grid;
    align-content: center;
    justify-items: center;
    min-width: 0;
  }
  .title__name {
    margin: 0;
    font: 700 calc(32px * var(--af-scale, 1)) / 1.15 var(--af-font);
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
