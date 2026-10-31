<!--
  The portrait inspector (ED3D.5f; ED3D spec §9 the Portrait frame): below `wide` the inspector is the shell's bottom
  sheet, with four tabs. Sector shows the card for what is selected (a room, a wall or a thing); Walls lists the selected
  room's walls and Things the level's things, and tapping a row selects it; Checks says how the level's checks stand.
  The tab is bound to the frame, which keeps it while the sheet is away at `wide`, so a rotation comes back to it; a
  selection made elsewhere never moves it.
-->
<script lang="ts">
import { Tabs } from '@mcthaydt/automata-editor-kit'
import type { InspectorCard, InspectorRow } from '../../app/inspector-cards'
import type { InspectorChange, InspectorPhase } from '../../app/inspector-edits'
import type { MaterialTarget } from '../../app/material-session'
import Inspector from './Inspector.svelte'

interface Props {
  card: InspectorCard
  walls: readonly InspectorRow[]
  things: readonly InspectorRow[]
  checks: string
  onchange: (change: InspectorChange, phase: InspectorPhase) => string | undefined
  onselect: (id: string) => void
  onmaterial?: ((target: MaterialTarget) => void) | undefined
  /** The open tab, bound by the frame. */
  tab?: string
}

let {
  card,
  walls,
  things,
  checks,
  onchange,
  onselect,
  onmaterial,
  tab = $bindable('sector'),
}: Props = $props()

const TABS = [
  { id: 'sector', label: 'Sector' },
  { id: 'walls', label: 'Walls' },
  { id: 'things', label: 'Things' },
  { id: 'checks', label: 'Checks' },
]
</script>

{#snippet rows(list: readonly InspectorRow[], empty: string)}
  {#if list.length === 0}
    <p class="empty">{empty}</p>
  {:else}
    <ul>
      {#each list as row (row.id)}
        <li>
          <button type="button" aria-pressed={row.selected} onclick={() => onselect(row.id)}>{row.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="sheet" data-testid="portrait-sheet">
  <Tabs label="Inspector" tabs={TABS} value={tab} onselect={(id) => (tab = id)}>
    {#snippet panel(id)}
      {#if id === 'sector'}
        <Inspector {card} {onchange} {onmaterial} />
      {:else if id === 'walls'}
        {@render rows(walls, 'Select a room to list its walls.')}
      {:else if id === 'things'}
        {@render rows(things, 'This level has no things yet.')}
      {:else}
        <p class="checks">{checks}</p>
      {/if}
    {/snippet}
  </Tabs>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  /* The tabs keep their height in the short peek sheet (a flex column would shrink them under the panel), and stay in
     view while the sheet's content scrolls under them. */
  .sheet :global([role='tablist']) {
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-bg-surface);
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2) var(--space-4);
    list-style: none;
  }
  button {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-accent-default);
    background: var(--color-bg-raised);
  }
  .empty,
  .checks {
    margin: 0;
    padding: var(--space-4);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
