<script lang="ts">
  import { CREATIVE_STARTS } from '../../data/creative-starts'
</script>

<div class="creative-starts">
  {#each CREATIVE_STARTS as game}
    <article>
      <a class="creative-preview" href={game.href}><img src={game.image} alt={game.alt} width="1280" height="720" loading="lazy" /></a>
      <div class="creative-copy"><h3>{game.title}</h3><p>{game.description}</p><div class="link-row"><a class="button" href={game.href}>{game.action}</a><a href={game.nextHref}>{game.next}</a></div></div>
    </article>
  {/each}
</div>

<style>
  /* The first starter leads as a wide split; the other two sit side by side, picture over words. */
  .creative-starts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(3rem, 6vw, 5rem) clamp(1.5rem, 3vw, 2.5rem); }
  article { display: grid; gap: 1.75rem; align-content: start; }
  article:first-child { grid-column: 1 / -1; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: clamp(2rem, 4vw, 4rem); align-items: center; }
  .creative-preview { display: block; background: var(--charcoal); border-radius: var(--radius-lg); overflow: hidden; }
  img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; }
  h3 { font-weight: 420; letter-spacing: -.04em; line-height: 1.05; font-size: var(--step-title); max-width: 16ch; }
  .creative-copy > p { color: var(--muted); }
  .link-row { gap: 1rem 1.5rem; margin-bottom: 0; }
  @media (prefers-reduced-motion: no-preference) {
    img { transition: transform 400ms var(--ease-out); }
    .creative-preview:hover img { transform: scale(1.02); }
  }
  @media (max-width: 700px) {
    .creative-starts { grid-template-columns: minmax(0, 1fr); }
    article, article:first-child { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
    .creative-preview { border-radius: var(--radius); }
  }
</style>
