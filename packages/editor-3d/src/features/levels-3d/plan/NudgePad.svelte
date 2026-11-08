<!--
  The nudge pad (ED3D.6g-b; ED3D spec §5.3 flow 2, §9 the `Draw a sector` frame): while a sector is drawn with touch or
  a Pencil, four 44 px arrows move the last corner one grid step on the plan (up is north, towards smaller z) and the
  48 px middle closes the sector. It sits in the bottom corner `nudgePlace` chose, clear of the contact point, and above
  whatever covers the plan's foot (`--plan-foot`: the portrait tool strip and sheet).
-->
<script lang="ts">
interface Props {
  side: 'left' | 'right'
  onnudge: (dx: number, dz: number) => void
  onclose: () => void
}

const { side, onnudge, onclose }: Props = $props()

const ARROWS = [
  { name: 'Nudge up', glyph: '↑', dx: 0, dz: -1, area: 'up' },
  { name: 'Nudge left', glyph: '←', dx: -1, dz: 0, area: 'left' },
  { name: 'Nudge right', glyph: '→', dx: 1, dz: 0, area: 'right' },
  { name: 'Nudge down', glyph: '↓', dx: 0, dz: 1, area: 'down' },
] as const
</script>

<div class="pad" role="group" aria-label="Nudge the last corner" data-side={side}>
  {#each ARROWS as arrow (arrow.area)}
    <button
      type="button"
      class="arrow"
      style:grid-area={arrow.area}
      aria-label={arrow.name}
      onclick={() => onnudge(arrow.dx, arrow.dz)}
    >
      <span aria-hidden="true">{arrow.glyph}</span>
    </button>
  {/each}
  <button type="button" class="close" aria-label="Close" onclick={onclose}>
    <span aria-hidden="true">✓</span>
  </button>
</div>

<style>
  .pad {
    position: absolute;
    bottom: calc(12px + var(--plan-foot, 0px));
    z-index: 1;
    display: grid;
    grid-template-areas:
      '. up .'
      'left close right'
      '. down .';
    grid-template-columns: 44px 48px 44px;
    grid-template-rows: 44px 48px 44px;
    place-items: center;
    width: 148px;
    height: 148px;
    box-sizing: border-box;
    padding: 4px;
    border: 1px solid var(--color-border-default);
    border-radius: 50%;
    background: var(--color-bg-surface);
    box-shadow: var(--shadow);
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    font: 500 18px / 1 var(--font-sans, sans-serif);
  }
  .pad[data-side='right'] {
    right: 12px;
  }
  .pad[data-side='left'] {
    left: 12px;
  }
  .arrow {
    width: 44px;
    height: 44px;
    background: transparent;
    color: var(--color-text-primary);
  }
  .close {
    grid-area: close;
    width: 48px;
    height: 48px;
    background: var(--color-accent-default);
    color: var(--color-accent-ink, #1a1206);
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
</style>
