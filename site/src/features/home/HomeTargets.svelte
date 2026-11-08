<script lang="ts">
// "Publish": the four places a game goes, each with the command that puts it there.
import Icon from '../../shared/components/Icon.svelte'
import { TARGETS } from './home-content'
</script>

<section class="home-section">
  <div class="page-wrap">
    <p class="home-kicker">Publish</p>
    <h2>One build. Four places to put it.</h2>
    <div class="targets">
      {#each TARGETS as target (target.title)}
        <div class="target">
          <span class="home-icon"><Icon name={target.icon} size={18} /></span>
          <h3>{target.title}</h3>
          <p>{target.body}</p>
          <!-- The command over two lines, the target on the second, as a terminal would wrap it. -->
          <code data-scroll-region="horizontal">{target.command.replace(' --target', '\n  --target')}</code>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .targets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 48px;
  }
  .target {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
  }
  .target p {
    margin: 0 0 20px;
    color: var(--muted);
    font-size: 15px;
    line-height: 24px;
  }
  .target code {
    margin-top: auto;
    padding: 10px 12px;
    overflow-x: auto;
    border-radius: var(--edge-sm);
    background: var(--soft);
    color: var(--ink);
    font: 400 12.5px/18px var(--font-mono);
    white-space: pre;
  }
  @media (max-width: 1199px) {
    .targets {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 760px) {
    .targets {
      grid-template-columns: 1fr;
    }
  }
</style>
