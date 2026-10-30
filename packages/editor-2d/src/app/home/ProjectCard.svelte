<!--
  One project in the list (plan ED2D.4c2a): a tile with the project's initial in its kind's accent, the title with its
  badge, the kind and the file's size and age, and the path with the folder shortened before the file name. It is an
  option of the list's listbox, not a focusable control: the list owns the keys and the focus (`aria-activedescendant`).
  When the profile names a level to preview and the thumbnails service draws it (ED2D.4c3b), the tile shows that level
  instead of the initial; the image is decorative, since the title names the project.
-->
<script lang="ts">
import type { LevelThumbnails } from '../../canvas/level-thumbnails'
import Pill from '../controls/Pill.svelte'
import type { ProjectEntry } from '../project-list'
import { cardTitle, entryBadge, modifiedLabel, sizeLabel, splitPath } from './home-model'

interface Props {
  id: string
  entry: ProjectEntry
  selected: boolean
  /** The accent's CSS variable name, from the profile's place in the registry. */
  accent: string
  /** The time the age is told against. */
  now: number
  /** Draws the entry's preview level; absent where there is no WebGL renderer (the jsdom tests). */
  thumbnails?: LevelThumbnails | undefined
  onpointerdown: (event: PointerEvent) => void
  onclick: () => void
  ondblclick: () => void
}

const { id, entry, selected, accent, now, thumbnails, onpointerdown, onclick, ondblclick }: Props = $props()

const title = $derived(cardTitle(entry))
const badge = $derived(entryBadge(entry))
const path = $derived(splitPath(entry.path))
// An undecided file has no kind yet: it lists the profiles that claim it.
const kind = $derived(
  entry.status === 'ambiguous'
    ? entry.candidates.map((candidate) => candidate.label).join(' or ')
    : entry.profile.label,
)

let thumbnail = $state<string | undefined>(undefined)
// A changed file (path, size or time) is a new key, so the card redraws after the project is saved.
$effect(() => {
  const preview = entry.status === 'ok' ? entry.preview : undefined
  thumbnail = undefined
  if (thumbnails === undefined || preview === undefined) return
  let current = true
  void thumbnails.thumbnail(`${entry.path}|${entry.size}|${entry.mtime}`, preview).then((url) => {
    if (current) thumbnail = url
  })
  return () => {
    current = false
  }
})
</script>

<!-- The option takes pointer input only: the listbox owns focus and handles the same actions from the keyboard. -->
<!-- svelte-ignore a11y_interactive_supports_focus, a11y_click_events_have_key_events -->
<div
  {id}
  class="card"
  role="option"
  aria-selected={selected}
  style:--kind={`var(${accent})`}
  {onpointerdown}
  {onclick}
  {ondblclick}
>
  <span class="tile" aria-hidden="true">
    {#if thumbnail}<img src={thumbnail} alt="" />{:else}{[...title][0]?.toUpperCase() ?? ''}{/if}
  </span>
  <span class="text">
    <span class="head">
      <span class="title">{title}</span>
      <Pill tone={badge.tone}>{badge.text}</Pill>
    </span>
    <span class="meta">
      <Pill accent={entry.status === 'ambiguous' ? undefined : '--kind'}>{kind}</Pill>
      <span class="stats">{sizeLabel(entry.size)} · {modifiedLabel(entry.mtime, now)}</span>
    </span>
    <span class="path" title={entry.path}>
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
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-surface);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  @media (hover: hover) {
    .card:hover {
      border-color: var(--color-border-strong);
    }
  }
  .card[aria-selected='true'] {
    border-color: var(--color-accent-default);
    box-shadow: 0 0 0 1px var(--color-accent-default);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 1px solid color-mix(in srgb, var(--kind) 55%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--kind) 16%, var(--color-bg-canvas));
    color: var(--kind);
    font: var(--text-display-20);
    overflow: hidden;
  }
  .tile img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
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
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .path {
    display: flex;
    min-width: 0;
    color: var(--color-text-faint);
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
