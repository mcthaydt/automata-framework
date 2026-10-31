<!--
  The New sector card in the inspector (ED3D.6g-b; ED3D spec §9 the `Draw a sector` frame): each placed point with its
  plan coordinates (three decimals, as the file writes them) and the length of the edge that reaches it, then what the
  next tap does.
-->
<script lang="ts">
import type { DrawEdge } from '../../app/sector-tool-controller'
import type { Point } from '../../format/sector.schema'

interface Props {
  corners: readonly Point[]
  edges: readonly DrawEdge[]
  closing: boolean
}

const { corners, edges, closing }: Props = $props()

const placed = $derived(edges.filter((edge) => !edge.pending))
</script>

<section class="card" aria-labelledby="new-sector-heading">
  <h2 id="new-sector-heading">New sector</h2>
  <ul aria-label="Points">
    {#each corners as corner, index (index)}
      <li>
        <span class="number" class:last={index === corners.length - 1}>{index + 1}</span>
        <span class="at">{corner.x.toFixed(3)}, {corner.z.toFixed(3)}</span>
        {#if index > 0 && placed[index - 1] !== undefined}
          <span class="length">{placed[index - 1]?.length.toFixed(2)} m</span>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="next">
    {closing ? 'A tap on point 1 closes the sector' : `Tap to place point ${corners.length + 1}`}
  </p>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    text-transform: uppercase;
  }
  ul {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    color: var(--color-text-primary);
    font: 500 12px / 16px var(--font-mono, monospace);
  }
  .number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 1px solid var(--color-border-strong);
    border-radius: 50%;
    color: var(--color-text-dim);
    font-size: 11px;
  }
  .number.last {
    border-color: var(--color-accent-default);
    background: var(--color-accent-default);
    color: var(--color-accent-ink, #1a1206);
  }
  .at {
    flex: 1;
  }
  .length {
    color: var(--color-text-dim);
  }
  .next {
    margin: 0;
    color: var(--color-text-faint, var(--color-text-dim));
    font: 500 12px / 16px var(--font-mono, monospace);
  }
</style>
