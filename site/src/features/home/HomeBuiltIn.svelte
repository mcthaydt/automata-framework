<script lang="ts">
// "Built in": what every Automata game has from its first run, in a grid of six. The GTM research's first pain is
// that a demo is not a game yet ("six weeks vanish into save/load, menus, and settings"), so this comes right after the
// claim. Each item is a part of the framework today (`home-content.ts` says which).
import Icon from '../../shared/components/Icon.svelte'
import { BUILT_IN } from './home-content'
</script>

<section class="home-section">
  <div class="page-wrap">
    <span class="home-kicker"><Icon name="check" size={14} />{BUILT_IN.kicker}</span>
    <h2>{BUILT_IN.title}</h2>
    <p class="home-sub">{BUILT_IN.sub}</p>
    <ul class="built" aria-label="Built into every game">
      {#each BUILT_IN.items as [name, words] (name)}
        <li>
          <h3>{name}</h3>
          <p>{words}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  /* The same hairline grid as the Publish row, three across and two down. */
  .built {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 56px 0 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
    list-style: none;
  }
  li {
    min-width: 0;
    margin: 0;
    padding: 24px;
  }
  li:nth-child(3n + 2),
  li:nth-child(3n + 3) {
    border-left: 1px solid var(--line);
  }
  li:nth-child(n + 4) {
    border-top: 1px solid var(--line);
  }
  h3 {
    margin: 0 0 4px;
    font-size: 16px;
    line-height: 22px;
    letter-spacing: 0;
  }
  li p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 22px;
  }
  @media (max-width: 1023px) {
    .built {
      grid-template-columns: 1fr 1fr;
    }
    li:nth-child(n) {
      border-top: 0;
      border-left: 0;
    }
    li:nth-child(2n) {
      border-left: 1px solid var(--line);
    }
    li:nth-child(n + 3) {
      border-top: 1px solid var(--line);
    }
  }
  @media (max-width: 760px) {
    .built {
      grid-template-columns: 1fr;
      margin-top: 40px;
    }
    li:nth-child(n) {
      border-left: 0;
    }
    li + li {
      border-top: 1px solid var(--line);
    }
  }
</style>
