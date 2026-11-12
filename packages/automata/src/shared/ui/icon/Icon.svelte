<!--
  @component
  One of the three symbols core draws itself: a check, a cross and a turning arrow. They are inline SVG, not text,
  because the pixel font every game ships has no glyph for a check mark, a cross or a turning arrow and no language may fall back to the device's
  fonts. It takes its size from the text around it (`1em`) and its colour from `currentColor`, hides from assistive
  technology (the owner says what it means in words) and is never in the focus order.
-->
<script lang="ts" module>
export type IconName = 'check' | 'cross' | 'rotate'
</script>

<script lang="ts">
interface Props {
  name: IconName
}

const { name }: Props = $props()
</script>

<svg
  class="af-icon"
  data-icon={name}
  viewBox="0 0 16 16"
  width="1em"
  height="1em"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="square"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'check'}
    <path d="M3 8.5 6.5 12 13 4" />
  {:else if name === 'cross'}
    <path d="M4 4 12 12M12 4 4 12" />
  {:else}
    <path d="M13 8A5 5 0 1 1 11.5 4.5M13 2.5V6H9.5" />
  {/if}
</svg>

<style>
  .af-icon {
    display: inline-block;
    vertical-align: -0.125em;
    flex: none;
  }
</style>
