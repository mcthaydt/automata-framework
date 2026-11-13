<script lang="ts">
// "Built for agents": three plain points beside a real example's lines, highlighted, with what they draw under them.

import example from 'virtual:framework/home-example'
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import Icon from '../../shared/components/Icon.svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import { AGENT_SECTION } from './home-content'

// The drawing sits below the first screen, so its code is its own chunk, fetched once the page is live: the Home page's
// preloaded script stays inside its budget now that the whole example is on the page.
let Preview: typeof import('./ShapesPreview.svelte').default | undefined = $state()
$effect(() => {
  import('./ShapesPreview.svelte').then((module) => {
    Preview = module.default
  })
})
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
      <div class="head"><span class="tab">{example.file}</span><span class="sp">{example.dir}</span></div>
      <CodeBlock code={example.code} lang="ts" label="" regionLabel="The example's code, whole" describedBy="shapes-code-hint" class="sample" />
      <p id="shapes-code-hint" class="hint">{AGENT_SECTION.scrollHint}</p>
      <div class="run">
        <div class="stage">{#if Preview}<Preview />{/if}</div>
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
  /* The whole file is shown. It is taller than the picture beside it, so the code is a scroll region of a set height
     (keyboard-focusable, from CodeBlock), and no line is cut to make it fit. */
  .show :global(.sample .code-scroll) {
    max-height: 22rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  /* Under the code, in words: the file is longer than its box and its long lines run past the edge. */
  .hint {
    margin: 0;
    padding: 8px 20px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font: 400 12px/18px var(--font-mono);
  }
  .run {
    border-top: 1px solid var(--line);
    background: #0f131b;
  }
  /* The drawing has its own box, so a block that falls to the bottom never passes behind the label under it. */
  .stage {
    position: relative;
    aspect-ratio: 16 / 9;
  }
  .stage :global(canvas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .runbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font: 400 12px/18px var(--font-mono);
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
    .show :global(.sample .code-scroll) {
      max-height: 16rem;
    }
    .hint,
    .runbar {
      padding-inline: 14px;
    }
  }
</style>
