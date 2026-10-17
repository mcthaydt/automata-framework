<!--
  The M4.6 primitives for the layout contracts (U-a, M4 spec §4.12), one per `show`, each in a screen
  with Back in its corner row as a game would draw it. The overlays (Modal, Sheet, Toast) sit over such
  a screen. Words are English stand-ins of a typical length.
-->
<script lang="ts" module>
export const PRIMITIVE_SHOWS = [
  'split',
  'option-group',
  'pager-dots',
  'paged-grid',
  'controls',
  'slider',
  'chip',
  'modal',
  'sheet',
  'toast',
] as const
export type PrimitiveShow = (typeof PRIMITIVE_SHOWS)[number]
</script>

<script lang="ts">
import Button from '../controls/Button.svelte'
import IconButton from '../controls/IconButton.svelte'
import Slider from '../controls/Slider.svelte'
import Toggle from '../controls/Toggle.svelte'
import Modal from '../dialog/Modal.svelte'
import Sheet from '../dialog/Sheet.svelte'
import OptionGroup from '../layout/OptionGroup.svelte'
import PagedGrid from '../layout/PagedGrid.svelte'
import PagerDots from '../layout/PagerDots.svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import Split from '../layout/Split.svelte'
import Chip from '../status/Chip.svelte'
import Toast from '../status/Toast.svelte'

const { show }: { show: PrimitiveShow } = $props()
const none = (): void => undefined
const OPTIONS = ['low', 'medium', 'high'].map((value) => ({
  value,
  label: value[0]?.toUpperCase() + value.slice(1),
  testId: `option-${value}`,
}))
const tiles = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(from + i), name: `Level ${from + i + 1}` }))
const GROUPS = [
  { id: 'forest', title: 'Forest', items: tiles(0, 18) },
  { id: 'caves', title: 'Caves', items: tiles(18, 12) },
]
</script>

{#snippet gear()}
  <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor" /></svg>
{/snippet}

<ScreenFrame arrangement="stack" back={none} backLabel="Back">
  {#snippet body()}
    {#if show === 'split'}
      <Split min={240}>
        {#snippet first()}<button type="button" class="af-control" data-testid="split-first">Level 1</button>{/snippet}
        {#snippet second()}<button type="button" class="af-control" data-testid="split-second">Play</button>{/snippet}
      </Split>
    {:else if show === 'option-group'}
      <OptionGroup label="Quality" options={OPTIONS} value="medium" onchange={none} />
    {:else if show === 'pager-dots'}
      <PagerDots label="Pages" count={5} index={1} onselect={none} />
    {:else if show === 'paged-grid'}
      <div style="height: 100%; min-height: 0; display: grid">
        <PagedGrid label="Levels" groups={GROUPS} most={{ columns: 4, rows: 3 }} page={0} onpage={none}>
          {#snippet item(tile)}
            <button type="button" class="af-control" style="width: 100%; height: 100%" data-testid={`tile-${tile.id}`}
              >{tile.name}</button
            >
          {/snippet}
        </PagedGrid>
      </div>
    {:else if show === 'controls'}
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <Button kind="primary" testId="button-primary">{#snippet children()}Play{/snippet}</Button>
        <Button kind="ghost" testId="button-ghost">{#snippet children()}Credits{/snippet}</Button>
        <IconButton label="Settings" icon={gear} testId="icon-button" />
        <Toggle label="Music" checked onLabel="On" offLabel="Off" onchange={none} testId="toggle" />
      </div>
    {:else if show === 'slider'}
      <Slider
        label="Music volume"
        value={40}
        min={0}
        max={100}
        step={10}
        valueText={(value) => `${value}%`}
        onchange={none}
        testId="slider"
      />
    {:else if show === 'chip'}
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <Chip text="New" />
        <Chip text="Saved" tone="success" toneLabel="Done" />
        <Chip text="Offline" tone="danger" toneLabel="Problem" testId="chip-danger" />
      </div>
    {:else}
      <p style="margin: 0">Choose a level</p>
    {/if}
  {/snippet}
</ScreenFrame>

{#if show === 'modal'}
  <Modal title="Levels" closeLabel="Close" onclose={none}>
    <p style="margin: 0">Every level you have reached is listed here, with your best time on each.</p>
    {#snippet actions()}
      <Button kind="primary" testId="modal-done">{#snippet children()}Done{/snippet}</Button>
    {/snippet}
  </Modal>
{:else if show === 'sheet'}
  <Sheet title="More" closeLabel="Close" onclose={none}>
    <p style="margin: 0">Credits, licences and the privacy notice.</p>
    {#snippet actions()}
      <Button kind="primary" testId="sheet-done">{#snippet children()}Done{/snippet}</Button>
    {/snippet}
  </Sheet>
{:else if show === 'toast'}
  <Toast text="This controller is not supported" tone="warning" toneLabel="Warning" testId="toast" />
{/if}
