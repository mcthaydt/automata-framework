<script lang="ts">
  import { CREATIVE_STARTS } from '../../data/creative-starts'
</script>

<div class="creative-starts">
  {#each CREATIVE_STARTS as game}
    <article>
      <a class="creative-preview" href={game.href}><img src={game.image} alt={game.alt} width="1280" height="720" loading="lazy" /></a>
      <div class="creative-copy"><p class="small">{game.kind}</p><h3>{game.title}</h3><p>{game.description}</p><div class="link-row"><a class="button" href={game.href}>{game.action}</a><a href={game.nextHref}>{game.next}</a></div></div>
    </article>
  {/each}
</div>

<style>
  .creative-starts { display: grid; gap: 4rem; }
  article { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 3rem; align-items: center; }
  article:nth-child(2) .creative-preview { order: 2; }
  .creative-preview { display: block; background: var(--stage); overflow: hidden; }
  img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; }
  h3 { font-size: clamp(1.75rem, 1.2rem + 1.4vw, 2.75rem); max-width: 20ch; }
  .creative-copy > .small { margin-bottom: .75rem; }
  .link-row { gap: 1rem 1.5rem; margin-bottom: 0; }
  @media (prefers-reduced-motion: no-preference) {
    img { transition: transform 180ms ease-out; }
    .creative-preview:hover img { transform: scale(1.015); }
  }
  @media (max-width: 700px) {
    article { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
    article:nth-child(2) .creative-preview { order: 0; }
    .creative-starts { gap: 3rem; }
  }
</style>
