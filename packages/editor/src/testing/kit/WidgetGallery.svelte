<!--
  Every kit widget on one page, for the layout tests: production CSS in a real browser
  checks that each interactive element has its hit area, that nothing makes the page scroll sideways, that every
  kind of control shows a focus ring, and that a dialog stays on a phone screen. `presentation` is what the
  editor would pick from the shell mode: popovers on wide, sheets below.
-->
<script lang="ts">
import '../../shared/kit/tokens.css'
import '../../shared/kit/fonts.css'
import Button from '../../shared/kit/widgets/Button.svelte'
import Chips from '../../shared/kit/widgets/Chips.svelte'
import ColorField from '../../shared/kit/widgets/ColorField.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import Picker from '../../shared/kit/widgets/Picker.svelte'
import ReorderList from '../../shared/kit/widgets/ReorderList.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Slider from '../../shared/kit/widgets/Slider.svelte'
import StatusLine from '../../shared/kit/widgets/StatusLine.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import Tabs from '../../shared/kit/widgets/Tabs.svelte'
import ToastRegion from '../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../shared/kit/widgets/toasts'

interface Props {
  presentation?: 'popover' | 'sheet'
  dialogOpen?: boolean
}

const { presentation = 'popover', dialogOpen = false }: Props = $props()

let width = $state(16)
let opacity = $state(0.6)
let blend = $state('multiply')
let tags = $state(['solid'])
let tint = $state('#e0a54a')
let tab = $state('entity')
let terrain = $state<string | undefined>('grass')
// svelte-ignore state_referenced_locally
let open = $state(dialogOpen)
let layers = $state([
  { id: 'sky', label: 'Sky' },
  { id: 'fog', label: 'Fog' },
  { id: 'tiles', label: 'Tiles', locked: true, reason: 'The tile layer is always third' },
  { id: 'entities', label: 'Entities' },
])

const toasts = createToasts()
toasts.push({ kind: 'ok', message: 'Layer added' })
toasts.push({ message: 'Layer deleted', action: { label: 'Undo', run: () => {} } })
</script>

<div class="gallery" data-testid="gallery">
  <Stepper label="Width" bind:value={width} min={1} max={64} unit="px" />
  <Slider label="Opacity" bind:value={opacity} min={0} max={1} step={0.05} defaultValue={1} />
  <Segmented
    label="Blend"
    bind:value={blend}
    options={[
      { id: 'normal', label: 'Normal' },
      { id: 'multiply', label: 'Multiply' },
      { id: 'add', label: 'Add', disabled: true, reason: 'Needs WebGL' },
    ]}
  />
  <Chips
    label="Tags"
    mode="multi"
    selected={tags}
    items={[
      { id: 'solid', label: 'solid' },
      { id: 'water', label: 'water', removable: true },
      { id: 'slippery', label: 'slippery' },
    ]}
    onedit={(event) => (tags = [...event.value])}
  />
  <ColorField
    label="Tint"
    bind:value={tint}
    palette={['#e0a54a', '#6aa8e8', '#a58be0', '#6fbf9a', '#e07a6a', '#e6c35c']}
  />
  <Tabs
    label="Inspector"
    bind:value={tab}
    tabs={[
      { id: 'entity', label: 'Entity' },
      { id: 'level', label: 'Level' },
      { id: 'checks', label: 'Checks', disabled: true, reason: 'Nothing to check yet' },
    ]}
  >
    {#snippet panel(id)}<p class="panel">Panel {id}</p>{/snippet}
  </Tabs>
  <div class="row">
    <Menu
      label="Layer actions"
      {presentation}
      items={[
        { id: 'rename', label: 'Rename', detail: 'F2' },
        { id: 'duplicate', label: 'Duplicate' },
        'separator',
        { id: 'delete', label: 'Delete', detail: '⌫' },
      ]}
    />
    <Picker
      label="Terrain"
      {presentation}
      bind:value={terrain}
      searchable
      options={[
        { id: 'grass', label: 'Grass', group: 'Ground' },
        { id: 'sand', label: 'Sand', group: 'Ground', detail: 'Dry' },
        { id: 'water', label: 'Water', group: 'Liquid' },
        { id: 'lava', label: 'Lava', group: 'Liquid' },
      ]}
    />
  </div>
  <div class="row">
    <Button variant="primary">New level</Button>
    <Button>Duplicate level</Button>
    <Button variant="quiet">Cancel</Button>
    <Button variant="danger">Delete level</Button>
    <IconButton icon="undo" label="Undo last edit" />
  </div>
  <ReorderList label="Layers" items={layers} onreorder={(move) => {
    const next = [...layers]
    const [moved] = next.splice(move.from, 1)
    if (moved) next.splice(move.to, 0, moved)
    layers = next
  }} />
  <button type="button" class="open" onclick={() => (open = true)}>Delete layer…</button>
  <StatusLine save="dirty" message="Tile 12 × 4 selected" />
</div>

<Dialog bind:open title="Delete layer">
  <p>Its 14 tiles and 3 entities go with it. You can undo this until you close the editor.</p>
  {#snippet actions({ close })}
    <button type="button" onclick={() => close()}>Cancel</button>
    <button type="button" data-primary onclick={() => close()}>Delete layer</button>
  {/snippet}
</Dialog>

<ToastRegion {toasts} />

<style>
  :global(body) {
    margin: 0;
    background: var(--color-bg-app);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .gallery {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    box-sizing: border-box;
    max-width: 100%;
    padding: var(--space-4);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .panel {
    margin: var(--space-3);
  }
  .open {
    min-height: var(--size-hit);
  }
  .open:focus-visible {
    outline: 2px solid var(--color-accent-default);
  }
</style>
