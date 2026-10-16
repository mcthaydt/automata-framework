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
  .creative-starts { display: grid; gap: clamp(3rem, 6vw, 5rem); }
  article { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: clamp(2rem, 4vw, 4rem); align-items: center; }
  article:nth-child(2) .creative-preview { order: 2; }
  .creative-preview { display: block; background: var(--charcoal); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--lift); }
  img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; }
  h3 { font-weight: 420; letter-spacing: -.04em; line-height: 1.02; font-size: clamp(1.875rem, 1.2rem + 1.6vw, 2.875rem); max-width: 16ch; }
  .creative-copy > .small { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.25rem; font-family: var(--font-mono); font-size: var(--step-micro); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .creative-copy > .small::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--lime); box-shadow: var(--glow); }
  .creative-copy > p:not(.small) { color: var(--muted); }
  .link-row { gap: 1rem 1.5rem; margin-bottom: 0; }
  @media (prefers-reduced-motion: no-preference) {
    img { transition: transform 400ms var(--ease-out); }
    .creative-preview:hover img { transform: scale(1.02); }
  }
  @media (max-width: 700px) {
    article { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
    article:nth-child(2) .creative-preview { order: 0; }
    .creative-preview { border-radius: var(--radius); }
  }
</style>
