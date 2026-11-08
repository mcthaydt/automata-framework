<!--
  A stage of a given width with the floating toolbar over it as the Level view fills it: six tools and a brush size as the
  toolbar's second group, and a zoom toolbar at the bottom right. The stage is the container the toolbar wraps by, as
  the shell's canvas is. Used by the layout test (production CSS in a real browser).
-->
<script lang="ts">
import FloatingToolbar from '../../shared/kit/toolbar/FloatingToolbar.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'

interface Props {
  /** The stage's width in px: the toolbar wraps at 480 and under. */
  width: number
}

const { width }: Props = $props()
let tool = $state('brush')
let size = $state(1)
const TOOLS = [
  { id: 'select', label: 'Select', icon: 'select' as const },
  { id: 'brush', label: 'Brush', icon: 'brush' as const },
  { id: 'rectangle', label: 'Rectangle', icon: 'rectangle' as const },
  { id: 'fill', label: 'Fill', icon: 'fill' as const },
  { id: 'eraser', label: 'Eraser', icon: 'eraser' as const },
  { id: 'picker', label: 'Copy a tile', icon: 'eyedropper' as const },
]
</script>

{#snippet brush()}
  <IconButton icon="minus" label="Smaller brush" onclick={() => (size -= 1)} />
  <output aria-label="Brush size">{size}</output>
  <IconButton icon="plus" label="Bigger brush" onclick={() => (size += 1)} />
{/snippet}

<div class="stage" style:width={`${width}px`} data-testid="stage">
  <FloatingToolbar label="Tools" at="top" testId="tools" second={{ label: 'Brush size', children: brush }}>
    <Segmented label="Tool" options={TOOLS} bind:value={tool} />
  </FloatingToolbar>
  <FloatingToolbar label="Zoom" at="zoom" testId="zoom">
    <IconButton icon="minus" label="Zoom out" />
    <output aria-label="Zoom">67%</output>
    <IconButton icon="plus" label="Zoom in" />
  </FloatingToolbar>
</div>

<style>
  .stage {
    position: relative;
    container-type: inline-size;
    height: 320px;
    background: var(--charcoal);
  }
  output {
    min-width: 44px;
    text-align: center;
    font: var(--text-mono-12);
    color: var(--ink);
  }
</style>
