<!--
  The Level view's tools: one pill floating over the canvas (spec 11.4), centred at its top from an iPad up and at its
  foot on a phone, under the thumb (`at`), never running off the edge (G5). It holds, below `wide`, Layers (which opens the layers and
  the palette as a drawer or a sheet), then the six tools as icons, each named in plain words (its tooltip and its
  accessible name: Select, Brush, Rectangle, Fill, Eraser, Copy a tile), and while a brush or the eraser is out the
  brush size, a 44 px button showing the number that opens a popover with the stepper. Fit and Details are the
  canvas's own corner controls (`LevelStage`), so the pill stays one row on a 390 px phone.

  If a narrow canvas still cannot hold it, the pill scrolls sideways (a declared scroll region) rather than shrinking a
  control under 44 px. It shows no scroll bar: macOS draws an overlay bar along a scrolling row's bottom edge and
  WebKit hit-tests it (about 15 px; #272), which would take a tool's lower taps, so the bar is not drawn at all.
-->
<script lang="ts">
import type { IconName } from '../../shared/kit/icons/paths'
import Button from '../../shared/kit/widgets/Button.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
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
  onlayers: () => void
  /** Where the pill floats: the canvas's top, or its foot (a phone). */
  at?: 'top' | 'bottom'
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
const sized = $derived(tool === 'brush' || tool === 'eraser')
const isTool = (id: string): id is LevelTool => TOOLS.some((each) => each.id === id)

/** The size popover: opened from the size button, placed against it. */
let sizing = $state(false)
let sizeButton = $state<HTMLElement>()
</script>

<div
  class="pill"
  role="toolbar"
  aria-label="Tools"
  data-floating="true"
  data-at={at}
  data-testid="level-toolbar"
  data-scroll-region="both"
>
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
  {#if sized}
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
</div>

<style>
  /* Centred at the canvas's foot, never wider than it less a margin each side. */
  .pill {
    position: absolute;
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0;
    box-sizing: border-box;
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-lg);
    background: var(--color-bg-surface);
  }
  .pill[data-at='top'] {
    top: var(--space-3);
    bottom: auto;
  }
  .pill::-webkit-scrollbar {
    display: none;
  }
  /* Each item keeps its own width, so the pill scrolls instead of squeezing a control under its neighbour. */
  .pill > :global(*) {
    flex: 0 0 auto;
  }
  /* The pill is the tools' frame, so the segmented control inside it draws none of its own: a phone gets its 18 px. */
  .pill :global(.segmented) {
    gap: 0;
    padding: 0;
    border: 0;
  }
  .size {
    padding: var(--space-3);
  }
  /* The kit's stepper wraps its buttons under its label when squeezed; in the popover it never needs to. */
  .size :global(.stepper) {
    flex-wrap: nowrap;
  }
</style>
