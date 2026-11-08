<!--
  One icon of the kit's set (paths.ts), drawn in currentColor so it takes its colour from the text around it.
  Always decorative: the button or label around it carries the accessible name, so the svg is hidden from
  assistive technology and never takes focus.
-->
<script lang="ts">
import { ICONS, type IconName } from './paths'

let { name, size = 20 }: { name: IconName; size?: number } = $props()
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each ICONS[name] as [tag, attributes], index (index)}<svelte:element this={tag} {...attributes} />{/each}
</svg>

<style>
  .icon {
    flex: none;
    display: block;
  }
</style>
