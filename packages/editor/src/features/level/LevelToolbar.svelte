<!--
  The Level view's toolbar: the six tools as icons (each named in plain words, its tooltip and its accessible name:
  Select, Brush, Rectangle, Fill, Eraser, Copy a tile), the brush size behind a "Size" button while a brush or the
  eraser is out (a popover with the stepper, so the size never widens the row), Fit (the whole level in view), below
  `wide` Layers and Inspector, which open the panel and the inspector, and Levels where the dock is a sheet. One row
  over the canvas that scrolls sideways on a narrow screen rather than shrinking a control under 44 px.
-->
<script lang="ts">
import type { IconName } from '../../shared/kit/icons/paths'
import Button from '../../shared/kit/widgets/Button.svelte'
import Popup from '../../shared/kit/widgets/Popup.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import type { LevelTool } from '../../shared/level-2d/editor/level-editor-api'

interface Props {
  tool: LevelTool
  brushSize: number
  /** Below `wide` the panel is a drawer or a sheet, opened from here. */
  showLayers: boolean
  layersOpen: boolean
  ontool: (tool: LevelTool) => void
  onbrushsize: (size: number) => void
  onfit: () => void
  onlayers: () => void
  /** Below `wide` the inspector is a drawer or a sheet, opened from here. */
  showInspector: boolean
  inspectorOpen: boolean
  oninspector: () => void
  /** Where the dock is a sheet (below `wide`, and the short `wide` height), it opens from here (decision 4). */
  showLevels: boolean
  levelsOpen: boolean
  onlevels: () => void
}

const {
  tool,
  brushSize,
  showLayers,
  layersOpen,
  ontool,
  onbrushsize,
  onfit,
  onlayers,
  showInspector,
  inspectorOpen,
  oninspector,
  showLevels,
  levelsOpen,
  onlevels,
}: Props = $props()

const TOOLS: readonly { id: LevelTool; label: string; icon: IconName }[] = [
  { id: 'select', label: 'Select', icon: 'select' },
  { id: 'brush', label: 'Brush', icon: 'brush' },
  { id: 'rectangle', label: 'Rectangle', icon: 'rectangle' },
  { id: 'fill', label: 'Fill', icon: 'fill' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser' },
  { id: 'picker', label: 'Copy a tile', icon: 'eyedropper' },
]
const sized = $derived(tool === 'brush' || tool === 'eraser')
const isTool = (id: string): id is LevelTool => TOOLS.some((each) => each.id === id)

/** The size popover: opened from the "Size" button, placed against it. */
let sizing = $state(false)
let sizeButton = $state<HTMLElement>()
</script>

<div class="toolbar" data-testid="level-toolbar" data-scroll-region="both">
  {#if showLayers}
    <Button aria-expanded={layersOpen} onclick={onlayers}>Layers</Button>
  {/if}
  <div class="tools">
    <Segmented
      label="Tool"
      options={TOOLS}
      value={tool}
      onedit={(event) => {
        if (isTool(event.value)) ontool(event.value)
      }}
    />
  </div>
  {#if sized}
    <span bind:this={sizeButton}>
      <Button aria-expanded={sizing} aria-haspopup="dialog" onclick={() => (sizing = !sizing)}>Size {brushSize}</Button>
    </span>
    <Popup bind:open={sizing} anchor={sizeButton} label="Brush size">
      <div class="size">
        <Stepper
          label="Brush size"
          value={brushSize}
          min={1}
          max={8}
          integer
          onedit={(event) => {
            if (event.phase === 'set' || event.phase === 'commit') onbrushsize(event.value)
          }}
        />
      </div>
    </Popup>
  {/if}
  <Button onclick={onfit}>Fit</Button>
  {#if showLevels}
    <Button aria-expanded={levelsOpen} onclick={onlevels}>Levels</Button>
  {/if}
  {#if showInspector}
    <Button aria-expanded={inspectorOpen} onclick={oninspector}>Inspector</Button>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* The bottom edge keeps 16 px: macOS lays its overlay scroll bar (about 15 px, hit-tested in Safari) along it once
       the row scrolls sideways, and a tool under it would lose its taps there (#272, as #265 for region bodies). */
    padding: var(--space-2) var(--space-2) var(--space-4);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-surface);
  }
  /* Each item keeps its natural width, so the row scrolls instead of squeezing a label under its neighbour. */
  .toolbar > :global(*) {
    flex: 0 0 auto;
    width: max-content;
  }
  /* The kit's stepper wraps its buttons under its label when squeezed; in a row that scrolls it never needs to. */
  .size {
    padding: var(--space-3);
  }
  .size :global(.stepper) {
    flex-wrap: nowrap;
  }
</style>
