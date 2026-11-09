<!--
  The design board's page: one section per kind of kit component, each in its states (rest, chosen, disabled,
  invalid, busy, error), with fixture data. It marks itself ready (`data-board-ready`) once the fonts have loaded, so
  a screenshot never catches the fallback face.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { ICON_NAMES } from '../../shared/kit/icons/paths'
import ThemeChoice from '../../shared/kit/theme/ThemeChoice.svelte'
import Button from '../../shared/kit/widgets/Button.svelte'
import Chips from '../../shared/kit/widgets/Chips.svelte'
import ColorField from '../../shared/kit/widgets/ColorField.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import Picker from '../../shared/kit/widgets/Picker.svelte'
import Pill from '../../shared/kit/widgets/Pill.svelte'
import ReorderList from '../../shared/kit/widgets/ReorderList.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Slider from '../../shared/kit/widgets/Slider.svelte'
import StatusLine from '../../shared/kit/widgets/StatusLine.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import Tabs from '../../shared/kit/widgets/Tabs.svelte'
import ToastRegion from '../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../shared/kit/widgets/toasts'

const { dialogOpen = false }: { dialogOpen?: boolean } = $props()

let ready = $state(false)
onMount(() => {
  void document.fonts.ready.then(() => (ready = true))
})

let width = $state(16)
let opacity = $state(0.6)
let view = $state('level')
let tags = $state(['solid'])
let tint = $state('#1d278a')
let tab = $state('tile')
let terrain = $state<string | undefined>('grass')
// svelte-ignore state_referenced_locally
let open = $state(dialogOpen)
let layers = $state([
  { id: 'sky', label: 'Sky' },
  { id: 'tiles', label: 'Tiles', locked: true, reason: 'The tile layer is always under the characters' },
  { id: 'entities', label: 'Characters and items' },
])

const toasts = createToasts()
toasts.push({ kind: 'ok', message: 'Level saved' })
toasts.push({ message: 'Layer deleted', action: { label: 'Undo', run: () => {} } })
</script>

<main class="board" data-board-ready={ready || undefined}>
  <h1>Editor kit</h1>

  <!-- Both looks are one click away, so a reviewer sees every widget below in each. -->
  <ThemeChoice />

  <section>
    <h2>Buttons</h2>
    <div class="row">
      <Button variant="primary">Save</Button>
      <Button>Duplicate</Button>
      <Button variant="quiet">Cancel</Button>
      <Button variant="danger">Delete level</Button>
      <Button variant="primary" disabled>Saving…</Button>
      <Button disabled>Duplicate</Button>
    </div>
  </section>

  <section>
    <h2>Icon buttons</h2>
    <div class="row">
      {#each ICON_NAMES as icon (icon)}<IconButton {icon} label={icon} />{/each}
    </div>
    <div class="row">
      <IconButton icon="eye" label="Hide Sky" pressed />
      <IconButton icon="lock" label="Unlock Tiles" pressed={false} />
      <IconButton icon="layers" label="Layers" showLabel />
      <IconButton icon="undo" label="Undo" disabled />
    </div>
  </section>

  <section>
    <h2>Choices</h2>
    <Segmented
      label="View"
      bind:value={view}
      options={[
        { id: 'level', label: 'Level' },
        { id: 'map', label: 'Map' },
        { id: 'tiles', label: 'Tiles' },
        { id: 'characters', label: 'Characters' },
      ]}
    />
    <Tabs
      label="Inspector"
      bind:value={tab}
      tabs={[
        { id: 'tile', label: 'Tile' },
        { id: 'level', label: 'Level' },
        { id: 'rules', label: 'Rules', disabled: true, reason: 'This tileset has no rules' },
      ]}
    >
      {#snippet panel(id)}<p class="panel">Settings for {id}</p>{/snippet}
    </Tabs>
    <Chips
      label="Tags"
      mode="multi"
      selected={tags}
      items={[
        { id: 'solid', label: 'solid' },
        { id: 'water', label: 'water', removable: true },
        { id: 'ladder', label: 'ladder' },
      ]}
      onedit={(event) => (tags = [...event.value])}
    />
  </section>

  <section>
    <h2>Fields</h2>
    <Stepper label="Brush size" bind:value={width} min={1} max={8} unit="tiles" />
    <Slider label="Opacity" bind:value={opacity} min={0} max={1} step={0.05} defaultValue={1} />
    <ColorField label="Colour" bind:value={tint} palette={['#1d278a', '#0f4b49', '#cbf25c', '#b42318', '#11151c']} />
    <div class="row">
      <Menu
        label="More"
        items={[
          { id: 'open', label: 'Open' },
          { id: 'duplicate', label: 'Duplicate' },
          'separator',
          { id: 'delete', label: 'Delete' },
        ]}
      />
      <Picker
        label="Tile"
        bind:value={terrain}
        options={[
          { id: 'grass', label: 'Grass', group: 'Ground' },
          { id: 'water', label: 'Water', group: 'Liquid' },
        ]}
      />
    </div>
  </section>

  <section>
    <h2>Lists and labels</h2>
    <ReorderList
      label="Layers"
      items={layers}
      onreorder={(move) => {
        const next = [...layers]
        const [moved] = next.splice(move.from, 1)
        if (moved) next.splice(move.to, 0, moved)
        layers = next
      }}
    />
    <div class="row">
      <Pill tone="ok">Saved</Pill>
      <Pill tone="warn">2 problems</Pill>
      <Pill tone="bad">Couldn't save</Pill>
      <Pill accent="--color-layer-entities">Characters and items</Pill>
    </div>
    <StatusLine save="dirty" message="Tile 12 × 4 selected" />
    <Button onclick={() => (open = true)}>Delete level…</Button>
  </section>
</main>

<Dialog bind:open title="Delete this level?">
  <p>Its tiles and characters go with it. You can undo this until you close the editor.</p>
  {#snippet actions({ close })}
    <Button variant="quiet" onclick={() => close()}>Keep it</Button>
    <Button variant="primary" onclick={() => close()}>Delete level</Button>
  {/snippet}
</Dialog>

<ToastRegion {toasts} />

<style>
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-sans);
  }
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 64rem;
    padding: var(--space-5) var(--space-4) 8rem;
  }
  h1 {
    margin: 0;
    font-size: var(--step-lead);
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
  }
  h2 {
    margin: 0;
    color: var(--muted);
    font-size: var(--step-micro);
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .panel {
    margin: var(--space-3) 0 0;
  }
</style>
