<script lang="ts">
// "Publish": the research's third pain is getting a game in front of players. The four places a game goes, in one row, each with the command that puts it there.
import Icon from '../../shared/components/Icon.svelte'
import { PUBLISH_SECTION, TARGETS } from './home-content'
</script>

<section class="home-section">
  <div class="page-wrap">
    <span class="home-kicker"><Icon name="share" size={14} />{PUBLISH_SECTION.kicker}</span>
    <h2>{PUBLISH_SECTION.title}</h2>
    <p class="home-sub">{PUBLISH_SECTION.sub}</p>
    <ul class="targets">
      {#each TARGETS as target (target.title)}
        <li class="target">
          <Icon name={target.icon} size={20} />
          <h3>{target.title}</h3>
          <p>{target.body}</p>
          <!-- The command over two lines, the target on the second, as a terminal would wrap it. -->
          <code data-scroll-region="horizontal">{target.command.replace(' --target', '\n  --target')}</code>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .targets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 56px 0 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
    list-style: none;
  }
  .target {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    padding: 24px;
  }
  .target + .target {
    border-left: 1px solid var(--line);
  }
  h3 {
    margin: 18px 0 4px;
    font-size: 16px;
    line-height: 22px;
    letter-spacing: 0;
  }
  .target p {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 14px;
    line-height: 22px;
  }
  code {
    margin-top: auto;
    padding: 0;
    overflow-x: auto;
    background: none;
    color: var(--faint);
    font: 400 12px/18px var(--font-mono);
    white-space: pre;
  }
  @media (max-width: 1023px) {
    .targets {
      grid-template-columns: 1fr 1fr;
    }
    .target:nth-child(3) {
      border-left: 0;
    }
    .target:nth-child(n + 3) {
      border-top: 1px solid var(--line);
    }
  }
  @media (max-width: 760px) {
    .targets {
      grid-template-columns: 1fr;
      margin-top: 40px;
    }
    .target + .target {
      border-top: 1px solid var(--line);
      border-left: 0;
    }
  }
</style>
