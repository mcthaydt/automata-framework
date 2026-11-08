<!--
  The Level view's tools: one pill floating over the canvas, centred at its top from an iPad up and at its
  foot on a phone as a dock under the thumb (`at`), never running off the edge (G5). It holds, in the compact layout,
  Layers (which opens the layers and the palette as a sheet), then the six tools as icons, each named in plain words (its tooltip and its
  accessible name: Select, Brush, Rectangle, Fill, Eraser, Copy a tile), and while a brush or the eraser is out the
  brush size: − 1 + beside the tools from an iPad up, and on a phone's dock, which has no room, a 44 px button showing
  the number that opens a popover with the stepper. Fit and Details are the
  canvas's own corner controls (`LevelStage`), so the pill stays one row on a 390 px phone. The pill itself (where it
  floats, how it scrolls when a narrow canvas cannot hold it) is the kit's `FloatingToolbar`, shared with Map, Tiles and
  Characters.
-->
<script lang="ts">
import type { IconName } from '../../shared/kit/icons/paths'
import FloatingToolbar from '../../shared/kit/toolbar/FloatingToolbar.svelte'
import Button from '../../shared/kit/widgets/Button.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Popup from '../../shared/kit/widgets/Popup.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import type { LevelTool } from '../../shared/level-2d/model/editor-view'

interface Props {
  tool: LevelTool
  brushSize: number
  /** In the compact layout the panel is a sheet, opened from here. */
  showLayers: boolean
  layersOpen: boolean
  ontool: (tool: LevelTool) => void
  onbrushsize: (size: number) => void
  onlayers: () => void
  /** Where the pill floats: the canvas's top or foot, or a dock across the foot (the compact layout). */
  at?: 'top' | 'bottom' | 'dock'
}

const {
  tool,
  brushSize,
  showLayers,
  layersOpen,
  ontool,
  onbrushsize,
  onlayers,
  at = 'bottom',
}: Props = $props()

const TOOLS: readonly { id: LevelTool; label: string; icon: IconName }[] = [
  { id: 'select', label: 'Select', icon: 'select' },
  { id: 'brush', label: 'Brush', icon: 'brush' },
  { id: 'rectangle', label: 'Rectangle', icon: 'rectangle' },
  { id: 'fill', label: 'Fill', icon: 'fill' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser' },
  { id: 'picker', label: 'Copy a tile', icon: 'eyedropper' },
]
const MIN_BRUSH = 1
const MAX_BRUSH = 8
const sized = $derived(tool === 'brush' || tool === 'eraser')
const isTool = (id: string): id is LevelTool => TOOLS.some((each) => each.id === id)

/** The size popover: opened from the size button, placed against it. */
let sizing = $state(false)
let sizeButton = $state<HTMLElement>()
</script>

<FloatingToolbar label="Tools" {at} testId="level-toolbar">
  {#if showLayers}
    <IconButton icon="layers" label="Layers" aria-expanded={layersOpen} onclick={onlayers} />
  {/if}
  <Segmented
    label="Tool"
    options={TOOLS}
    value={tool}
    onedit={(event) => {
      if (isTool(event.value)) ontool(event.value)
    }}
  />
  {#if sized && at !== 'dock'}
    <!-- With room (an iPad up), the size is the approved mockup's − 1 +. -->
    <span class="stepper">
      <IconButton
        icon="minus"
        label="Smaller brush"
        disabled={brushSize <= MIN_BRUSH}
        onclick={() => onbrushsize(brushSize - 1)}
      />
      <output class="size-now" aria-label="Brush size">{brushSize}</output>
      <IconButton
        icon="plus"
        label="Bigger brush"
        disabled={brushSize >= MAX_BRUSH}
        onclick={() => onbrushsize(brushSize + 1)}
      />
    </span>
  {:else if sized}
    <span bind:this={sizeButton}>
      <Button
        aria-label={`Brush size ${brushSize}`}
        title="Brush size"
        aria-expanded={sizing}
        aria-haspopup="dialog"
        onclick={() => (sizing = !sizing)}>{brushSize}</Button
      >
    </span>
    <Popup bind:open={sizing} anchor={sizeButton} label="Brush size">
      <div class="size">
        <Stepper
          label="Brush size"
          value={brushSize}
          min={MIN_BRUSH}
          max={MAX_BRUSH}
          integer
          onedit={(event) => {
            if (event.phase === 'set' || event.phase === 'commit') onbrushsize(event.value)
          }}
        />
      </div>
    </Popup>
  {/if}
</FloatingToolbar>

<style>
  /* A hairline sets the size apart from the tools, as the mockup does. */
  .stepper {
    display: inline-flex;
    align-items: center;
    margin-left: var(--space-1);
    padding-left: var(--space-1);
    border-left: 1px solid var(--line);
  }
  .size-now {
    min-width: 1.75em;
    text-align: center;
    font: var(--text-mono-12);
    color: var(--color-text-primary);
  }
  .size {
    padding: var(--space-3);
  }
  /* The kit's stepper wraps its buttons under its label when squeezed; in the popover it never needs to. */
  .size :global(.stepper) {
    flex-wrap: nowrap;
  }
</style>
