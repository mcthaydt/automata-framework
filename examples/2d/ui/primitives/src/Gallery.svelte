<!--
  The gallery: pick a primitive and a variant; each card holds that primitive in a frame of one
  reference size, scaled to fit the card. The frames are real pages, so each runs its own geometry
  owner against its own window.
-->
<script lang="ts">
import type { ReferenceSize } from '@automata/framework/testing'

interface Props {
  primitives: readonly string[]
  sizes: readonly ReferenceSize[]
  variants: readonly string[]
  initialShow: string
  initialVariant: string
  /** The demo's page, loaded by each card in frame mode. */
  page: string
}

const { primitives, sizes, variants, initialShow, initialVariant, page }: Props = $props()

// Seeded once from the URL; the selects own them after that.
// svelte-ignore state_referenced_locally
let show = $state(initialShow)
// svelte-ignore state_referenced_locally
let variant = $state(initialVariant)

const CARD_WIDTH = 280
const scaleFor = (size: ReferenceSize): number => Math.min(1, CARD_WIDTH / size.width)
const frameUrl = (size: ReferenceSize): string => `${page}?frame=${show}&variant=${variant}&size=${size.name}`
</script>

<main class="gallery">
  <header class="controls">
    <h1>ui primitives</h1>
    <label>Primitive
      <select name="show" bind:value={show}>
        {#each primitives as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    </label>
    <label>Variant
      <select name="variant" bind:value={variant}>
        {#each variants as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    </label>
  </header>
  <ul class="cards">
    {#each sizes as size (size.name)}
      <li class="card">
        <a href={frameUrl(size)} target="_blank" rel="noopener">{size.name} · {size.width}×{size.height} · {size.formFactor}{size.heightTier ? ` · ${size.heightTier}` : ''}</a>
        <div class="viewport" style:width={`${size.width * scaleFor(size)}px`} style:height={`${size.height * scaleFor(size)}px`}>
          <iframe
            title={`${show} at ${size.width} by ${size.height}`}
            src={frameUrl(size)}
            width={size.width}
            height={size.height}
            loading="lazy"
            data-size={size.name}
            style:transform={`scale(${scaleFor(size)})`}
          ></iframe>
        </div>
      </li>
    {/each}
  </ul>
</main>

<style>
  /* The gallery is a page that scrolls, unlike a game screen. */
  :global(html),
  :global(body) {
    overflow: auto;
  }

  .gallery {
    padding: 16px;
    color: var(--af-ink);
    font-family: var(--af-font);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }

  .controls h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  .controls select {
    min-height: var(--af-target);
    margin-left: 8px;
    font: inherit;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }

  .card {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .card a {
    color: var(--af-muted);
    font-size: var(--af-text-small);
  }

  .viewport {
    overflow: hidden;
    border: var(--af-edge-width) solid var(--af-edge);
  }

  iframe {
    display: block;
    border: 0;
    transform-origin: 0 0;
  }
</style>
