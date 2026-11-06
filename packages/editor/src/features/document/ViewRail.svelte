<!--
  The rail: the profile's views as tabs, a column beside the canvas
  in `wide` and a tab bar along the foot below it. Arrow keys move between the tabs (one tab stop), Enter or a tap
  opens one (the view it opens remounts the rail, which then takes the focus back), and the current view is `aria-selected`. Every tab is at least 44 px each way.
-->
<script lang="ts">
import { onMount } from 'svelte'
import type { ViewDef } from '../../shared/level-2d/profiles/profile'

interface Props {
  views: readonly ViewDef[]
  current: string | undefined
  orientation: 'vertical' | 'horizontal'
  /** Focus the current tab when the rail appears: a view chosen from the rail remounts the shell around it. */
  focusCurrent?: boolean
  onselect: (id: string) => void
}

const { views, current, orientation, focusCurrent = false, onselect }: Props = $props()

let list = $state<HTMLElement>()
onMount(() => {
  if (focusCurrent) list?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
})

function step(event: KeyboardEvent): void {
  const back = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const index = views.findIndex((view) => view.id === current)
  const next =
    event.key === back
      ? index - 1
      : event.key === forward
        ? index + 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? views.length - 1
            : undefined
  if (next === undefined || views.length === 0) return
  event.preventDefault()
  const target = views[(next + views.length) % views.length]
  if (target === undefined) return
  onselect(target.id)
}
</script>

<div
  class="rail"
  role="tablist"
  aria-label="Views"
  aria-orientation={orientation}
  data-orientation={orientation}
  tabindex="-1"
  bind:this={list}
  onkeydown={step}
>
  {#each views as view (view.id)}
    <button
      type="button"
      role="tab"
      data-view={view.id}
      aria-selected={view.id === current}
      tabindex={view.id === current ? 0 : -1}
      onclick={() => onselect(view.id)}>{view.label}</button
    >
  {/each}
</div>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: var(--space-1);
    padding: var(--space-1);
  }
  .rail[data-orientation='horizontal'] {
    flex-direction: row;
  }
  button {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    padding: 0 2px;
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-dim);
    /* The eyebrow size fits "Tilesets" and "Entities" whole in the 56 px rail. */
    font: var(--text-eyebrow-11);
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .rail[data-orientation='horizontal'] button {
    flex: 1 1 0;
  }
  button[aria-selected='true'] {
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
</style>
