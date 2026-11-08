<script lang="ts">
// "Examples": six runnable examples as cards, each with its picture, its title, what it shows and its file. A card
// opens the example in the playground (never a template). The count is read from the catalogue.
import examples from 'virtual:framework/examples'
import facts from 'virtual:framework/facts'
import Icon from '../../shared/components/Icon.svelte'
import { HOME_EXAMPLES } from './home-content'

const cards = HOME_EXAMPLES.map((id) => {
  const found = examples.find((example) => example.id === id)
  if (found === undefined)
    throw new Error(`Home shows the example "${id}", which the catalogue does not have.`)
  return found
})

/** What an example shows, in its first sentence and with the code marks off: the catalogue's full text is for the example's own page. */
const sentence = (shows: string): string => {
  const plain = shows.replace(/`/g, '')
  return /^.*?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain
}
</script>

<section class="home-section">
  <div class="page-wrap">
    <div class="home-more">
      <div>
        <span class="home-kicker"><Icon name="play" size={14} />Examples</span>
        <h2>Start from something that runs.</h2>
      </div>
      <a class="home-secondary" href="/examples">All {facts.examples} examples <Icon name="arrowRight" /></a>
    </div>
    <ul class="cards">
      {#each cards as card (card.id)}
        <li>
          <a class="card" href={`/examples/${card.id}`}>
            <picture>
              <source
                type="image/webp"
                srcset={`/previews/example-${card.id}-640.webp 640w, /previews/example-${card.id}.webp 684w`}
                sizes="(max-width: 760px) 100vw, (max-width: 1023px) 50vw, 384px"
              />
              <img src={`/previews/example-${card.id}.jpg`} width="684" height="346" loading="lazy" alt="" />
            </picture>
            <div class="body">
              <h3>{card.title}</h3>
              <p>{sentence(card.shows)}</p>
              <div class="file"><span>{card.id}.ts</span><span class="open">Open</span></div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin: 56px 0 0;
    padding: 0;
    list-style: none;
  }
  .cards li {
    display: flex;
    margin: 0;
  }
  .card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
    text-decoration: none;
  }
  .card:hover {
    border-color: var(--line-strong);
  }
  .card img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    border-bottom: 1px solid var(--line);
    background: #0f131b;
    object-fit: cover;
  }
  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 18px 20px 20px;
  }
  h3 {
    margin: 0;
    font-size: 16px;
    line-height: 22px;
    letter-spacing: 0;
  }
  p {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 22px;
  }
  .file {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 14px;
    color: var(--faint);
    font: 400 12px/1 var(--font-mono);
  }
  .open {
    color: var(--ink);
  }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    .card {
      transition:
        border-color 0.14s,
        transform 0.14s;
    }
    .card:hover {
      transform: translateY(-2px);
    }
  }
  @media (max-width: 1023px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 760px) {
    .cards {
      grid-template-columns: 1fr;
      margin-top: 40px;
    }
  }
</style>
