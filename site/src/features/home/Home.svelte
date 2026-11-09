<!--
  Home, from the approved mockup (2026-11-06): one claim and the game it makes, three reasons, real code beside what
  it draws, the editor, the four places a game goes, and one closing ask. One lime button per screen (Make a game);
  everything else is the white secondary or a plain link. Every claim is something the framework does today
  (`home-content.ts` holds them, and its test holds them to the framework).
-->
<script lang="ts">
import CopyButton from '../../shared/components/CopyButton.svelte'
import Icon from '../../shared/components/Icon.svelte'
import NearView from '../../shared/components/NearView.svelte'
import DemoRunner from './DemoRunner.svelte'
import { CREATE_COMMAND, EXAMPLE_EXCERPT, EXAMPLE_FILE, REASONS, TARGETS } from './home-content'
import ShapesPreview from './ShapesPreview.svelte'
</script>

<section class="intro">
  <div class="wrap split-12">
    <div class="intro-text">
      <span class="tag">TypeScript · 2D · MIT licence</span>
      <h1>Make browser games with your coding agent.</h1>
      <p class="lead">
        Automata is a framework for 2D web games. Your agent writes the code and the tests; you draw the levels and play
        the result in a browser tab.
      </p>
      <div class="cta">
        <a class="button" href="/start">Make a game <Icon name="arrowRight" /></a>
      </div>
      <div class="cmd">
        <span aria-hidden="true">$</span><code>{CREATE_COMMAND}</code>
        <CopyButton text={CREATE_COMMAND} label="Copy the command" />
      </div>
    </div>
    <!-- The demo's own bar names the game; the poster's Play is its one control until it plays. -->
    <figure class="shot" id="play" aria-label="Emberwick, a platformer made with Automata">
      <DemoRunner
        src="/demos/emberwick/index.html"
        title="Emberwick"
        autoStart={false}
        poster="/previews/emberwick.jpg"
        posterAlt="Emberwick: a hooded hero below grassy stone ledges at night"
      />
    </figure>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="kicker">Why Automata</p>
    <h2>A game your agent can change without breaking it.</h2>
    <div class="reasons">
      {#each REASONS as reason (reason.title)}
        <div class="reason">
          <span class="ic"><Icon name={reason.icon} size={18} /></span>
          <h3>{reason.title}</h3>
          <p>{reason.body}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="kicker">The code</p>
    <h2>Small files. Plain TypeScript.</h2>
    <p class="sub">
      What happens in the game is written apart from how it looks, so a test can play it without a screen.
    </p>
    <div class="code-split">
      <div>
        <div class="filebar"><Icon name="copy" size={14} />{EXAMPLE_FILE}</div>
        <!-- A declared scroll region: on a phone the code scrolls sideways, never breaks inside a word. It takes focus
             so a keyboard can scroll it too. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <pre class="code" tabindex="0" aria-label={EXAMPLE_FILE} data-scroll-region="horizontal"><code>{EXAMPLE_EXCERPT}</code></pre>
      </div>
      <div class="run">
        <ShapesPreview />
        <span class="runbar"><i aria-hidden="true"></i>What it draws</span>
      </div>
    </div>
    <p class="more"><a href="/examples">See every example running</a></p>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="kicker">The editor</p>
    <h2>Draw levels. The game reads the same files.</h2>
    <p class="sub">
      The level editor runs in your browser. Draw a room, press Save, and your game plays the new room.
    </p>
    <div class="wide">
      <!-- Far below the poster: in the page only once the reader is near it (NearView, QB.3j). -->
      <NearView>
        <picture>
          <source media="(max-width: 760px)" type="image/webp" srcset="/previews/editor-phone.webp" />
          <source media="(max-width: 760px)" srcset="/previews/editor-phone.jpg" />
          <source
            type="image/webp"
            srcset="/previews/editor-800.webp 800w, /previews/editor.webp 1600w"
            sizes="(max-width: 1200px) 92vw, 1120px"
          />
          <img
            src="/previews/editor.jpg"
            width="1600"
            height="1000"
            loading="lazy"
            alt="The level editor on Emberwick: the layers on the left, the room in the middle, its details on the right"
          />
        </picture>
      </NearView>
    </div>
    <p class="more"><a href="/editor">More about the editor</a></p>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="kicker">Publish</p>
    <h2>One build. Four places to put it.</h2>
    <div class="targets">
      {#each TARGETS as target (target.title)}
        <div class="target">
          <span class="ic"><Icon name={target.icon} size={18} /></span>
          <h3>{target.title}</h3>
          <p>{target.body}</p>
          <!-- The command over two lines, the target on the second, as a terminal would wrap it. -->
          <code data-scroll-region="horizontal">{target.command.replace(' --target', '\n  --target')}</code>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="close">
  <div class="wrap split-12">
    <div>
      <h2>Make your first game today.</h2>
      <p class="sub">One command makes a working game. Play it, change it with your agent, and publish it.</p>
    </div>
    <div class="cta">
      <a class="button" href="/start">Make a game <Icon name="arrowRight" /></a>
      <a class="secondary" href="/docs">Read the docs</a>
    </div>
  </div>
</section>

<style>
  .wrap {
    width: min(var(--wrap), 100% - 2 * var(--side));
    margin: 0 auto;
  }
  /* Splits sit on a 12-column grid with 24 px gaps, so every right column starts on the same line. */
  .split-12 {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 24px;
    align-items: center;
  }
  section {
    padding: 112px 0;
    border-top: 1px solid var(--line);
  }
  .intro {
    display: flex;
    align-items: center;
    min-height: calc(100svh - 64px);
    padding: 48px 0;
    border-top: 0;
  }
  .intro-text {
    grid-column: span 5;
    min-width: 0;
    padding-right: 24px;
  }
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
  .tag,
  .kicker {
    margin: 0;
    color: var(--faint);
    font: 500 13px/20px var(--font-mono);
  }
  h1 {
    margin: 16px 0 0;
    font-size: clamp(40px, 4.4vw, 64px);
    font-weight: 600;
    line-height: 1.04;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }
  h2 {
    max-width: 760px;
    margin: 12px 0 0;
    font-size: clamp(30px, 3.4vw, 44px);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }
  h3 {
    margin: 20px 0 6px;
    font-size: 17px;
    font-weight: 600;
    line-height: 24px;
  }
  .lead,
  .sub {
    max-width: 560px;
    margin: 20px 0 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 28px;
  }
  .sub {
    margin-top: 16px;
    max-width: 620px;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
  }
  .secondary {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 18px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--panel);
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
  }
  .secondary:hover {
    border-color: var(--ink);
  }
  .cmd {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 520px;
    min-height: 48px;
    margin-top: 12px;
    padding: 0 2px 0 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--panel);
    font: 400 13.5px/1 var(--font-mono);
  }
  .cmd > span {
    color: var(--faint);
  }
  /* The global `code` rule scales to 0.88em; the command keeps the box's own size so it stays readable on a phone. */
  .cmd code {
    flex: 1;
    font-size: inherit;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ic {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--soft);
  }
  .reasons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 48px;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
  }
  .reason {
    padding: 32px;
  }
  .reason + .reason {
    border-left: 1px solid var(--line);
  }
  .reason h3 {
    margin-top: 24px;
  }
  .reason p,
  .target p {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 24px;
  }
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
  .code {
    margin: 0;
    padding: 20px 24px;
    overflow-x: auto;
    border-right: 1px solid var(--line);
    color: #24292f;
    font: 400 13.5px/22px var(--font-mono);
    white-space: pre;
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
  .more {
    margin: 20px 0 0;
  }
  .more a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--ink);
    font-weight: 500;
    text-underline-offset: 4px;
  }
  .wide {
    margin-top: 48px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-lg);
    box-shadow: 0 24px 64px -32px rgb(17 21 28 / 0.3);
  }
  .wide,
  .wide img {
    aspect-ratio: 16 / 10;
  }
  .wide img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
    object-position: 50% 0;
  }
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
    margin-bottom: 20px;
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
  .close .split-12 {
    align-items: start;
  }
  .close .split-12 > div:first-child {
    grid-column: span 7;
  }
  .close .cta {
    grid-column: 8 / -1;
    justify-content: flex-end;
    margin-top: 0;
    padding-top: 8px;
  }
  @media (max-width: 1199px) {
    .targets {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 1023px) {
    .intro {
      min-height: 0;
      padding: 64px 0;
    }
    .split-12 {
      grid-template-columns: 1fr;
      gap: 40px;
    }
    .intro-text,
    .shot,
    .close .split-12 > div:first-child,
    .close .cta {
      grid-column: 1 / -1;
      padding-right: 0;
    }
    .code-split {
      grid-template-columns: 1fr;
    }
    .code {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .close .cta {
      justify-content: flex-start;
      padding-top: 0;
    }
  }
  @media (max-width: 760px) {
    section {
      padding: 72px 0;
    }
    .intro {
      padding: 40px 0 48px;
    }
    .cta > :global(*) {
      flex: 1;
      justify-content: center;
    }
    .cmd {
      font-size: 13px;
    }
    .reasons {
      grid-template-columns: 1fr;
    }
    .reason {
      padding: 24px;
    }
    .reason + .reason {
      border-top: 1px solid var(--line);
      border-left: 0;
    }
    .code {
      padding: 16px;
      font-size: 12px;
      line-height: 20px;
    }
    .run {
      min-height: 0;
      aspect-ratio: 16 / 10;
    }
    .wide {
      width: min(300px, 100%);
      margin-inline: auto;
    }
    .wide,
    .wide img {
      aspect-ratio: 390 / 844;
    }
    .targets {
      grid-template-columns: 1fr;
    }
    .close .cta {
      flex-direction: column;
    }
    .close .cta > :global(*) {
      width: 100%;
    }
  }
  /* A phone on its side (audit M3): one column would push the demo below the fold, so the words and the game sit
     side by side, as on a desktop, and the heading shrinks to fit the short screen. */
  @media (orientation: landscape) and (max-height: 500px) and (min-width: 640px) {
    .intro {
      padding: 20px 0;
    }
    .intro .split-12 {
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 24px;
    }
    .intro-text {
      grid-column: span 6;
    }
    .intro .shot {
      grid-column: span 6;
    }
    .intro h1 {
      margin-top: 8px;
      font-size: 28px;
    }
    .intro .lead {
      margin-top: 12px;
      font-size: 15px;
      line-height: 22px;
    }
    .intro .cta {
      margin-top: 16px;
    }
  }
</style>
