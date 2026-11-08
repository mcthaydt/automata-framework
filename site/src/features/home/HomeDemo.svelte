<script lang="ts">
// The game on Home: its picture and its one bar (DemoRunner). The bar names the game; Play it is its one control until
// it plays.
import DemoRunner from './DemoRunner.svelte'
import { DEMO_BAR } from './home-content'
</script>

<figure class="shot" id="play" aria-label="Emberwick, a platformer made with Automata">
  <DemoRunner
    src="/demos/emberwick/index.html"
    poster="/previews/emberwick.jpg"
    posterAlt="Emberwick: a hooded hero below grassy stone ledges at night"
    bar={DEMO_BAR}
  />
</figure>

<style>
  .shot {
    grid-column: span 7;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-lg);
    background: var(--stage, #0e1014);
    box-shadow:
      0 1px 2px rgb(17 21 28 / 0.06),
      0 24px 64px -24px rgb(17 21 28 / 0.35);
  }
  @media (max-width: 1023px) {
    .shot {
      grid-column: 1 / -1;
    }
  }
  @media (orientation: landscape) and (max-height: 500px) and (min-width: 640px) {
    .shot {
      grid-column: span 6;
    }
  }
</style>
