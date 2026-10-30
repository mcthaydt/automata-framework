<!--
  A shell with every region filled the way the 2D editor fills them (kit spec §7, §8): a top bar that
  toggles the three openable regions, a rail of five destinations, a scrolling panel, an inspector of
  fields, a dock of scene buttons and a canvas with a text field. Used by the unit tests (behavior) and
  by the layout tests (production CSS in a real browser). It shows `orientation` and the open flags so
  a test can read what the shell told it. `broken` puts a widget with a bug in one region (kit spec §6).
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata-ui'
import EditorShell from '../shell/EditorShell.svelte'
import type { SnippetRegion } from '../shell/region-error'
import StatusLine from '../widgets/StatusLine.svelte'
import BrokenWidget from './BrokenWidget.svelte'
import '../tokens.css'

interface Props {
  geometry: GeometryState
  panelOpen?: boolean
  inspectorOpen?: boolean
  dockOpen?: boolean | undefined
  /** `false` leaves the rail out, as a screen with no destinations (Home) does. */
  rail?: boolean
  /** `false` leaves the panel out, as a screen with nothing to list beside its canvas (the suite's Home) does. */
  panel?: boolean
  /** `false` leaves the inspector out, as a view whose inspector is not built yet does. */
  inspector?: boolean
  /** `false` leaves the dock out, as a screen with nothing to put beneath its canvas (Home) does. */
  dock?: boolean
  /** Fills the status region with the kit's `StatusLine`, as a real screen does, instead of a plain readout. */
  statusLine?: boolean
  /** The region whose content throws, and whether it throws at once or after its button is clicked. */
  broken?: SnippetRegion | undefined
  breaks?: 'mount' | 'click'
}

const {
  geometry,
  rail: withRail = true,
  panel: withPanel = true,
  inspector: withInspector = true,
  dock: withDock = true,
  statusLine = false,
  broken,
  breaks = 'mount',
  panelOpen: panelStart = false,
  inspectorOpen: inspectorStart = false,
  dockOpen: dockStart,
}: Props = $props()

// The props only say how a test starts; from then on the shell's flags are the fixture's own state.
// svelte-ignore state_referenced_locally
let panelOpen = $state(panelStart)
// svelte-ignore state_referenced_locally
let inspectorOpen = $state(inspectorStart)
// svelte-ignore state_referenced_locally
let dockOpen = $state<boolean | undefined>(dockStart)

const destinations = ['Stage', 'Path', 'Parts', 'Checks', 'Export']
const layers = [
  'rain',
  'steam',
  'signs',
  'wires',
  'birds',
  'glow',
  'moss',
  'dust',
  'ivy',
  'neon',
  'puddles',
  'pipes',
  'chimneys',
  'vents',
  'sky',
  'cityFar',
  'cityMid',
  'cityNear',
  'tiles',
  'props',
  'entities',
  'intgrid',
  'fog',
  'light',
]
const fields = ['depth', 'sink', 'haze', 'seed', 'phrase', 'extension', 'set piece', 'name']
const scenes = ['floor 1', 'floor 2', 'floor 3', 'floor 4', 'floor 5', 'floor 6']
</script>

{#snippet bug(region: SnippetRegion)}
  {#if broken === region}<BrokenWidget {breaks} />{/if}
{/snippet}

{#snippet railBody({ orientation }: { orientation: 'vertical' | 'horizontal' })}
  {@render bug('rail')}
  <div class="rail" data-testid="rail" data-orientation={orientation}>
    {#each destinations as destination (destination)}
      <button type="button" data-testid={`rail-${destination}`}>{destination}</button>
    {/each}
  </div>
{/snippet}

{#snippet dockBody()}
  {@render bug('dock')}
  <div class="scenes">
    {#each scenes as scene (scene)}
      <button type="button" data-testid={`scene-${scene}`}>{scene}</button>
    {/each}
  </div>
{/snippet}

{#snippet panelBody()}
  {@render bug('panel')}
  <input data-testid="panel-field" aria-label="Find a layer" />
  <ul class="list">
    {#each layers as layer (layer)}
      <li><button type="button" data-testid={`layer-${layer}`}>{layer}</button></li>
    {/each}
  </ul>
{/snippet}

{#snippet inspectorBody()}
  {@render bug('inspector')}
  {#each fields as field (field)}
    <label class="field">{field}<input data-testid={`field-${field}`} /></label>
  {/each}
{/snippet}

<EditorShell
  {geometry}
  rail={withRail ? railBody : undefined}
  dock={withDock ? dockBody : undefined}
  panel={withPanel ? panelBody : undefined}
  inspector={withInspector ? inspectorBody : undefined}
  bind:panelOpen
  bind:inspectorOpen
  bind:dockOpen
  testId="shell"
>
  {#snippet topbar()}
    {@render bug('topbar')}
    <button type="button" data-testid="toggle-panel" onclick={() => (panelOpen = !panelOpen)}>Layers</button>
    <button type="button" data-testid="toggle-inspector" onclick={() => (inspectorOpen = !inspectorOpen)}>Fields</button>
    <button type="button" data-testid="toggle-dock" onclick={() => (dockOpen = !(dockOpen ?? false))}>Climb</button>
    <strong class="title">Rooftops</strong>
  {/snippet}
  {#snippet canvas()}
    {@render bug('canvas')}
    <div class="stage" data-testid="stage">
      <input data-testid="canvas-field" aria-label="Stage name" />
    </div>
  {/snippet}
  {#snippet status()}
    {@render bug('status')}
    {#if statusLine}
      <StatusLine save="saved" message="Ready" />
    {:else}
      <span data-testid="open-state">panel:{panelOpen} inspector:{inspectorOpen} dock:{String(dockOpen)}</span>
    {/if}
  {/snippet}
</EditorShell>

<style>
  button,
  input {
    min-height: var(--size-hit);
    min-width: var(--size-hit);
    box-sizing: border-box;
    font: var(--text-body-13);
    color: var(--color-text-primary);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .title {
    font: var(--text-title-15);
  }

  .rail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  :global([data-region='rail'][data-presentation='tabbar']) .rail {
    flex-direction: row;
  }

  .rail button {
    flex: 1;
    padding: 0;
    font: var(--text-eyebrow-11);
    letter-spacing: 0;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-1);
  }

  .field {
    display: grid;
    gap: var(--space-1);
    font: var(--text-label-12);
  }

  .scenes {
    display: flex;
    gap: var(--space-2);
  }

  .stage {
    display: grid;
    place-items: center;
    height: 100%;
  }
</style>
