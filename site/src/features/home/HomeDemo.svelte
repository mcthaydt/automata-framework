<script lang="ts">
// The game on Home, under the claim: one bar above it that names the game and, once it plays, says which keys to use;
// Play it is the bar's one control until it plays (DemoRunner).
import DemoRunner from './DemoRunner.svelte'
import { DEMO_BAR } from './home-content'
</script>

<figure class="stage" id="play" aria-label="Emberwick, a platformer made with Automata">
  <DemoRunner
    src="/demos/emberwick/index.html"
    start="room"
    poster="/previews/emberwick.jpg"
    posterAlt="Emberwick: a hooded hero below grassy stone ledges at night"
    bar={DEMO_BAR}
  />
</figure>

<style>
  /* The game stands on the page's edge: open at the bottom, with a faint lime light under it. */
  .stage {
    max-width: 1080px;
    margin: 64px auto 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-bottom: 0;
    border-radius: var(--edge-lg) var(--edge-lg) 0 0;
    background: var(--stage);
    box-shadow: 0 -24px 120px -40px rgb(203 242 92 / 0.18);
    text-align: left;
  }
  @media (max-width: 760px) {
    .stage {
      margin-top: 40px;
    }
  }
</style>
