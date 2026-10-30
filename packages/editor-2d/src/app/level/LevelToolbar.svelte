<!--
  The Level view's toolbar (plan ED2D.4c4a decision 4; 2D editor spec §5.9, §8, §12): the tool in plain words, the
  brush size while a brush or the eraser is out, Fit (the whole level in view) and, below `wide`, Layers, which opens the
  panel. One row over the canvas that scrolls sideways on a narrow screen rather than shrinking a control under 44 px.
-->
<script lang="ts">
import { Button, Segmented, Stepper } from '@mcthaydt/automata-editor-kit'
import type { LevelTool } from '../level-editor'

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
}

const { tool, brushSize, showLayers, layersOpen, ontool, onbrushsize, onfit, onlayers }: Props = $props()

const TOOLS: readonly { id: LevelTool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'brush', label: 'Brush' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'fill', label: 'Fill' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'picker', label: 'Pick' },
]
const sized = $derived(tool === 'brush' || tool === 'eraser')
const isTool = (id: string): id is LevelTool => TOOLS.some((each) => each.id === id)
</script>

<div class="toolbar" data-testid="level-toolbar">
  {#if showLayers}
    <Button aria-expanded={layersOpen} onclick={onlayers}>Layers</Button>
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
  {/if}
  <Button onclick={onfit}>Fit</Button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-surface);
  }
  .toolbar > :global(*) {
    flex: 0 0 auto;
  }
</style>
