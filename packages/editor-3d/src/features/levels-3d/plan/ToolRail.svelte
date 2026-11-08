<!--
  The Plan view's tool rail (ED3D.6g-a; ED3D spec §9 the Split and Draw frames' tool rail, §10 the keys): one 44 px
  button per tool, the active one pressed and each naming its key. Polygon, Rectangle, Split and Merge are the Sector
  tool's shapes, so they all press Sector, and Sector chooses the polygon. Vertical beside the plan at `wide`, a tab bar
  along the foot below that. A phone has no rail: the plan there is view and select only (spec §10).
-->
<script lang="ts">
import type { PlanToolId } from './plan-tools'

interface Props {
  active: PlanToolId
  orientation?: 'vertical' | 'horizontal' | undefined
  onchoose: (tool: PlanToolId) => void
}

const { active, orientation = 'vertical', onchoose }: Props = $props()

type RailTool = 'select' | 'sector' | 'vertex' | 'portal' | 'door' | 'window' | 'things'

const TOOLS: readonly {
  readonly id: RailTool
  readonly label: string
  readonly key: string
  readonly choose: PlanToolId
}[] = [
  { id: 'select', label: 'Select', key: 'V', choose: 'select' },
  { id: 'sector', label: 'Sector', key: 'S', choose: 'polygon' },
  { id: 'vertex', label: 'Vertex', key: 'X', choose: 'vertex' },
  { id: 'portal', label: 'Portal', key: 'P', choose: 'portal' },
  { id: 'door', label: 'Door', key: 'D', choose: 'door' },
  { id: 'window', label: 'Window', key: 'N', choose: 'window' },
  { id: 'things', label: 'Things', key: 'T', choose: 'things' },
]

const SECTOR_SHAPES: readonly PlanToolId[] = ['polygon', 'rectangle', 'split', 'merge']
const pressed = $derived<RailTool>(SECTOR_SHAPES.includes(active) ? 'sector' : (active as RailTool))
</script>

<div class="rail" role="toolbar" aria-label="Tools" aria-orientation={orientation} data-orientation={orientation}>
  {#each TOOLS as tool (tool.id)}
    <button
      type="button"
      aria-pressed={pressed === tool.id}
      aria-keyshortcuts={tool.key}
      title={`${tool.label} (${tool.key})`}
      onclick={() => onchoose(tool.choose)}
    >
      {tool.label}
    </button>
  {/each}
</div>

<style>
  /* As the 2D editor's view rail: the eyebrow size fits "Window" and "Vertex" whole in the kit's 56 px rail. */
  .rail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: var(--space-1);
    padding: var(--space-1);
  }
  .rail[data-orientation='horizontal'] {
    flex-direction: row;
  }
  button {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    padding: 0 2px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .rail[data-orientation='horizontal'] button {
    flex: 1 1 0;
  }
  button[aria-pressed='true'] {
    background: var(--color-bg-raised);
    color: var(--color-accent-default);
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
</style>
