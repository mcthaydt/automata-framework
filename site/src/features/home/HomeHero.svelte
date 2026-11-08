<script lang="ts">
// Home's first screen: the claim, the one lime button, the first command and the game it makes.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import Icon from '../../shared/components/Icon.svelte'
import HomeDemo from './HomeDemo.svelte'
import { CREATE_COMMAND } from './home-content'
</script>

<section class="home-section intro">
  <div class="page-wrap split-12">
    <div class="intro-text">
      <span class="tag">TypeScript · 2D · MIT licence</span>
      <h1>Make browser games with your coding agent.</h1>
      <p class="lead">
        Automata is a framework for 2D web games. Your agent writes the code and the tests; you draw the levels and play
        the result in a browser tab.
      </p>
      <div class="home-cta">
        <a class="button" href="/start">Make a game <Icon name="arrowRight" /></a>
      </div>
      <div class="cmd"><CodeBlock code={CREATE_COMMAND} variant="command" /></div>
    </div>
    <HomeDemo />
  </div>
</section>

<style>
  .intro-text {
    grid-column: span 5;
    min-width: 0;
    padding-right: 24px;
  }
  .tag {
    color: var(--faint);
    font: 500 13px/20px var(--font-mono);
  }
  h1 {
    margin: 16px 0 0;
    font-size: clamp(40px, 4.4vw, 64px);
    line-height: 1.04;
  }
  .lead {
    max-width: 560px;
    margin: 20px 0 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 28px;
  }
  .cmd {
    max-width: 520px;
    margin-top: 12px;
  }
  @media (max-width: 1023px) {
    .intro-text {
      grid-column: 1 / -1;
      padding-right: 0;
    }
  }
  /* A phone on its side: one column would push the demo below the fold, so the words and the game sit
     side by side, as on a desktop, and the heading shrinks to fit the short screen. */
  @media (orientation: landscape) and (max-height: 500px) and (min-width: 640px) {
    .split-12 {
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 24px;
    }
    .intro-text {
      grid-column: span 6;
    }
    h1 {
      margin-top: 8px;
      font-size: 28px;
    }
    .lead {
      margin-top: 12px;
      font-size: 15px;
      line-height: 22px;
    }
    .home-cta {
      margin-top: 16px;
    }
  }
</style>
