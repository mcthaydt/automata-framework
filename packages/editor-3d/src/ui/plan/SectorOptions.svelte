<!--
  The Sector tool's options over the plan (ED3D.6g-a; ED3D spec §5.3 flow 2, §9 the `Draw a sector` frame): the shape
  (Polygon, Rectangle, Split, Merge) at the top; while corners are placed, Undo point and Close sector at the bottom (Close
  is pressable with any corner, so a close with too few is refused in the tool's own sentence, ED3-m); and after a close
  whose walls lie on a neighbour's, one question per shared wall (the mockup's shared-wall hint), with Accept all when
  there is more than one. The shape cannot change while the offers are open: the step is still open.
-->
<script lang="ts">
import { Button, Segmented } from '@mcthaydt/automata-editor-kit'
import type { PlanToolId } from '../../app/plan-tools'
import type { PortalOffer } from '../../model/portal-offers'

type Shape = 'polygon' | 'rectangle' | 'split' | 'merge'

interface Props {
  tool: Shape
  corners: number
  offers: readonly PortalOffer[]
  onshape: (shape: PlanToolId) => void
  onundopoint: () => void
  onclose: () => void
  onaccept: (index: number) => void
  ondecline: (index: number) => void
  onacceptall: () => void
}

const { tool, corners, offers, onshape, onundopoint, onclose, onaccept, ondecline, onacceptall }: Props =
  $props()

const answering = $derived(offers.length > 0)
const options = $derived(
  (
    [
      ['polygon', 'Polygon'],
      ['rectangle', 'Rectangle'],
      ['split', 'Split'],
      ['merge', 'Merge'],
    ] as const
  ).map(([id, label]) => ({
    id,
    label,
    disabled: answering && id !== tool,
    reason: answering ? 'Answer the shared walls first' : undefined,
  })),
)
</script>

<div class="shapes" data-testid="sector-options">
  <Segmented label="Sector shape" {options} value={tool} onedit={(event) => onshape(event.value as Shape)} />
</div>

{#if answering}
  <div class="offers" role="group" aria-label="Shared walls">
    {#each offers as offer, index (`${offer.sector}/${offer.corner}`)}
      <div class="offer">
        <p>Shares a {offer.length.toFixed(2)} m wall with {offer.to}. Make it a portal?</p>
        <Button variant="primary" onclick={() => onaccept(index)}>Portal</Button>
        <Button onclick={() => ondecline(index)}>Keep solid</Button>
      </div>
    {/each}
    {#if offers.length > 1}
      <Button onclick={onacceptall}>Portal on every shared wall</Button>
    {/if}
  </div>
{:else if corners > 0 && (tool === 'polygon' || tool === 'rectangle')}
  <div class="actions" role="group" aria-label="Drawing">
    <Button onclick={onundopoint}>Undo point</Button>
    <Button variant="primary" onclick={onclose}>Close sector</Button>
  </div>
{/if}

<style>
  .shapes,
  .offers,
  .actions {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
    box-shadow: var(--shadow-pop, none);
  }
  .shapes {
    top: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 2 * var(--space-3));
  }
  .actions,
  .offers {
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 2 * var(--space-3));
  }
  .offers {
    flex-direction: column;
    align-items: stretch;
  }
  .offer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .offer p {
    flex: 1 1 16ch;
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
