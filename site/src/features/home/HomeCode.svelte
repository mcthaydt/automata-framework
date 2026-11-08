<script lang="ts">
// "The code": a real example's lines, highlighted, beside what they draw.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import Icon from '../../shared/components/Icon.svelte'
import { EXAMPLE_EXCERPT, EXAMPLE_FILE } from './home-content'
import ShapesPreview from './ShapesPreview.svelte'
</script>

<section class="home-section">
  <div class="page-wrap">
    <p class="home-kicker">The code</p>
    <h2>Small files. Plain TypeScript.</h2>
    <p class="home-sub">
      Gameplay is components and systems. Drawing is a separate view, so the game logic runs the same in tests and on
      screen.
    </p>
    <div class="code-split">
      <div>
        <div class="filebar"><Icon name="copy" size={14} />{EXAMPLE_FILE}</div>
        <CodeBlock code={EXAMPLE_EXCERPT} lang="ts" label="" class="sample" />
      </div>
      <div class="run">
        <ShapesPreview />
        <span class="runbar"><i aria-hidden="true"></i>What it draws</span>
      </div>
    </div>
    <p class="home-more"><a href="/examples">See every example running</a></p>
  </div>
</section>

<style>
  /* The code and what it draws, on the 7 / 5 line. */
  .code-split {
    display: grid;
    grid-template-columns: 7fr 5fr;
    margin-top: 48px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-lg);
    background: var(--panel);
  }
  .code-split > div {
    min-width: 0;
  }
  .filebar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    border-bottom: 1px solid var(--line);
    background: var(--soft);
    color: var(--faint);
    font: 400 13px/1 var(--font-mono);
  }
  /* The sample sits flush in the panel: the panel draws the border. */
  .code-split :global(.sample .box) {
    border: 0;
    border-right: 1px solid var(--line);
    border-radius: 0;
  }
  .code-split :global(.sample pre) {
    font: 400 13.5px/22px var(--font-mono);
  }
  .run {
    position: relative;
    min-height: 320px;
    background: #151a24;
  }
  .run :global(canvas) {
    position: absolute;
    inset: 0 0 36px;
    height: calc(100% - 36px);
  }
  .runbar {
    position: absolute;
    bottom: 14px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #c9ced6;
    font: 400 12px/1 var(--font-mono);
  }
  .runbar i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--lime);
  }
  @media (max-width: 1023px) {
    .code-split {
      grid-template-columns: 1fr;
    }
    .code-split :global(.sample .box) {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
  @media (max-width: 760px) {
    .code-split :global(.sample pre) {
      font-size: 12px;
      line-height: 20px;
    }
    .run {
      min-height: 0;
      aspect-ratio: 16 / 10;
    }
  }
</style>
