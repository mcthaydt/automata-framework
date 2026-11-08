<script lang="ts">
// The closing ask: make a first game.
import Icon from '../../shared/components/Icon.svelte'
</script>

<section class="home-section close">
  <div class="page-wrap split-12">
    <div class="words">
      <h2>Make your first game today.</h2>
      <p class="home-sub">One command makes a working game. Play it, change it with your agent, and publish it.</p>
    </div>
    <div class="home-cta ask">
      <a class="button" href="/start">Make a game <Icon name="arrowRight" /></a>
      <a class="home-secondary" href="/docs">Read the docs</a>
    </div>
  </div>
</section>

<style>
  .close .split-12 {
    align-items: start;
  }
  .words {
    grid-column: span 7;
  }
  .ask {
    grid-column: 8 / -1;
    justify-content: flex-end;
    margin-top: 0;
    padding-top: 8px;
  }
  @media (max-width: 1023px) {
    .words,
    .ask {
      grid-column: 1 / -1;
    }
    .ask {
      justify-content: flex-start;
      padding-top: 0;
    }
  }
  @media (max-width: 760px) {
    .ask {
      flex-direction: column;
    }
    .ask > :global(*) {
      width: 100%;
    }
  }
</style>
