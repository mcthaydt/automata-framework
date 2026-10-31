<!--
  The Plan view's tool rail (ED3D.6g-a; ED3D spec §9 the Split and Draw frames' tool rail, §10 the keys): one 44 px
  button per tool, the active one pressed and each naming its key. Polygon, Rectangle, Split and Merge are the Sector
  tool's shapes, so they all press Sector, and Sector chooses the polygon. On a phone the plan is view and select only
  (spec §10), so the rail offers Select alone. Vertical beside the plan at `wide`, a row above it below that.
-->
<script lang="ts">
import type { PlanToolId } from '../../app/plan-tools'

interface Props {
  active: PlanToolId
  compact: boolean
  orientation?: 'vertical' | 'horizontal' | undefined
  onchoose: (tool: PlanToolId) => void
}

const { active, compact, orientation = 'vertical', onchoose }: Props = $props()

type RailTool = 'select' | 'sector' | 'vertex' | 'portal' | 'door' | 'window'

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
]

const SECTOR_SHAPES: readonly PlanToolId[] = ['polygon', 'rectangle', 'split', 'merge']
const pressed = $derived<RailTool>(SECTOR_SHAPES.includes(active) ? 'sector' : (active as RailTool))
const shown = $derived(compact ? TOOLS.filter((tool) => tool.id === 'select') : TOOLS)
</script>

<div class="rail" role="toolbar" aria-label="Tools" aria-orientation={orientation} data-orientation={orientation}>
  {#each shown as tool (tool.id)}
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
  .rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
  }
  .rail[data-orientation='horizontal'] {
    flex-direction: row;
    overflow-x: auto;
  }
  button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-accent-default);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 1px;
  }
</style>
