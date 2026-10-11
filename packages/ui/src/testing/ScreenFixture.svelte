<!--
  A representative screen for the layout contracts (M1.6 plan Task 11): every frame part in use.
  Back and a corner control, a header, a hero, a list of rows that keeps two whole, and an action
  bar with a primary, a secondary and a utility. Stack on a portrait form factor, split otherwise,
  as a screen root would choose.
-->
<script lang="ts">
import ActionBar from '../layout/ActionBar.svelte'
import type { BarAction } from '../layout/action-bar'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import ScrollList from '../layout/ScrollList.svelte'

const { arrangement }: { arrangement: 'stack' | 'split' } = $props()

const ROWS = ['Forest', 'Cave', 'Tower', 'Lake', 'Ruins', 'Summit', 'Harbour', 'Garden']
const none = (): void => undefined
const barActions: BarAction[] = [
  { id: 'play', label: 'Play', kind: 'primary', onSelect: none },
  { id: 'settings', label: 'Settings', shortLabel: 'Set', kind: 'secondary', onSelect: none },
  { id: 'help', label: 'Help', kind: 'utility', onSelect: none },
]
</script>

<ScreenFrame {arrangement} back={none} backLabel="Back" testId="screen">
  {#snippet header()}<span data-testid="screen-title">Choose a level</span>{/snippet}
  {#snippet end()}<button type="button" class="af-control af-control--ghost" data-testid="mute">Mute</button>{/snippet}
  {#snippet hero()}<div data-testid="hero" style="width: 100%; height: 100%; min-height: 0; background: var(--af-panel)"></div>{/snippet}
  {#snippet body()}
    <ScrollList minRows={2} rowCount={ROWS.length} rowGap="8px" label="Levels" moreLabel={(n) => `+${n} more`} testId="levels">
      <div style="display: grid; gap: 8px">
        {#each ROWS as row (row)}
          <button type="button" class="af-control" data-row data-testid={`row-${row}`} style="width: 100%">{row}</button>
        {/each}
      </div>
    </ScrollList>
  {/snippet}
  {#snippet actions()}<ActionBar actions={barActions} testId="actions" />{/snippet}
</ScreenFrame>
