<script lang="ts">
// "Built for agents": three plain points beside a real example's lines, highlighted, with what they draw under them.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import Icon from '../../shared/components/Icon.svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import { AGENT_SECTION, EXAMPLE_EXCERPT, EXAMPLE_FILE, EXAMPLE_PATH } from './home-content'
import ShapesPreview from './ShapesPreview.svelte'
</script>

<section class="home-section">
  <div class="page-wrap home-chess">
    <div class="text">
      <span class="home-kicker"><Icon name="terminal" size={14} />{AGENT_SECTION.kicker}</span>
      <h2>{AGENT_SECTION.title}</h2>
      <p class="home-sub">{AGENT_SECTION.sub}</p>
      <ul class="home-points">
        {#each AGENT_SECTION.points as [lead, rest] (lead)}
          <li><Icon name="check" /><span><strong>{lead}</strong> <InlineText text={rest} /></span></li>
        {/each}
      </ul>
    </div>
    <div class="show home-panel">
      <div class="head"><span class="tab">{EXAMPLE_FILE}</span><span class="sp">{EXAMPLE_PATH.replace(/\/[^/]+$/, '')}</span></div>
      <CodeBlock code={EXAMPLE_EXCERPT} lang="ts" label="" class="sample" />
      <div class="run">
        <ShapesPreview />
        <span class="runbar"><i aria-hidden="true"></i>What it draws</span>
      </div>
    </div>
  </div>
</section>

<style>
  /* The sample sits flush in the panel: the panel draws the border. */
  .show :global(.sample .box) {
    border: 0;
    border-radius: 0;
  }
  .show :global(.sample pre) {
    font: 400 13px/21px var(--font-mono);
  }
  .run {
    position: relative;
    aspect-ratio: 16 / 9;
    border-top: 1px solid var(--line);
    background: #0f131b;
  }
  .run :global(canvas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .runbar {
    position: absolute;
    bottom: 10px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font: 400 12px/1 var(--font-mono);
  }
  .runbar i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--lime);
  }
  @media (max-width: 760px) {
    .show :global(.sample pre) {
      font-size: 12px;
      line-height: 19px;
    }
  }
</style>
