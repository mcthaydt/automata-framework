<!-- The parts of a conversation as boxes and arrows, computed from the file (nothing is saved); tap a box to go there. -->
<script lang="ts">
import type { DialogueGraph } from '@automata/narrative/sim'
import { layoutConversation, partWords } from './dialogue-model.ts'

const { graph, onpick }: { graph: DialogueGraph; onpick: (part: string) => void } = $props()
const BOX = { w: 132, h: 44, gapX: 24, gapY: 36 }
const layout = $derived(layoutConversation(graph))
const cols = $derived(Math.max(1, ...layout.boxes.map((box) => box.col + 1)))
const rows = $derived(Math.max(1, ...layout.boxes.map((box) => box.row + 1)))
const width = $derived(cols * (BOX.w + BOX.gapX) + BOX.gapX)
const height = $derived(rows * (BOX.h + BOX.gapY) + BOX.gapY)
const at = (id: string): { x: number; y: number } => {
  const box = layout.boxes.find((each) => each.id === id)
  return {
    x: BOX.gapX + (box?.col ?? 0) * (BOX.w + BOX.gapX),
    y: BOX.gapY + (box?.row ?? 0) * (BOX.h + BOX.gapY),
  }
}
</script>

<svg viewBox={`0 0 ${width} ${height}`} width="100%" role="group" aria-label="Parts and where they lead">
  <defs>
    <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
    </marker>
  </defs>
  {#each layout.arrows as arrow, index (index)}
    {@const from = at(arrow.from)}
    {@const to = at(arrow.to)}
    {#if arrow.back}
      <!-- A way back is a loop out of the right side, so it never crosses the boxes between. -->
      <path
        d={`M${from.x + BOX.w} ${from.y + BOX.h / 2} C ${from.x + BOX.w + 40} ${from.y + BOX.h / 2} ${to.x + BOX.w + 40} ${to.y + BOX.h / 2} ${to.x + BOX.w} ${to.y + BOX.h / 2}`}
        fill="none"
        stroke="currentColor"
        stroke-dasharray="4 3"
        marker-end="url(#head)"
      />
    {:else}
      <line
        x1={from.x + BOX.w / 2}
        y1={from.y + BOX.h}
        x2={to.x + BOX.w / 2}
        y2={to.y}
        stroke="currentColor"
        marker-end="url(#head)"
      />
    {/if}
  {/each}
  {#each layout.boxes as box (box.id)}
    {@const place = at(box.id)}
    <g
      role="button"
      tabindex="0"
      aria-label={`Go to ${partWords(box.id)}`}
      onclick={() => onpick(box.id)}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onpick(box.id)
      }}
    >
      <rect x={place.x} y={place.y} width={BOX.w} height={BOX.h} rx="3" fill="var(--color-bg-surface)" stroke="currentColor" />
      <text x={place.x + BOX.w / 2} y={place.y + BOX.h / 2 + 4} text-anchor="middle" fill="var(--color-text-primary)" font-size="13">
        {partWords(box.id)}
      </text>
    </g>
  {/each}
</svg>

<style>
  svg {
    color: var(--color-text-dim);
  }
  g {
    cursor: pointer;
  }
</style>
