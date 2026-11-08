<!--
  The Editor page: what the editors do in three pictures, "Try the editor" (the page `automata editor` serves every game,
  here on a sample game kept in this browser) and the command that opens it on a game. Home's look: one
  lime button, white panels on hairlines, 4/6/8 px corners.
-->
<script lang="ts">
import Icon from '../../shared/components/Icon.svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import TerminalBox from '../../shared/components/TerminalBox.svelte'
import { EDITOR_COMMAND, PICTURES } from './editor-content'

const webp = (src: string) => src.replace(/\.jpg$/, '.webp')
</script>

<PageMeta
  title="The editors"
  description="Make your whole game in the browser: levels in 2D and 3D, characters, how it feels, sounds, words, scenes and enemy behaviour. Every editor is free on the web. Try it here, nothing to install."
/>
<div class="wrap">
  <header class="top">
    <p class="kicker">Editor</p>
    <h1>Make your whole game in the browser.</h1>
    <p class="lead">
      The editors open on your game's folder. Levels paints the rooms, Characters dresses the people in them, and the Tuner,
      Feel, Audio, Writer, Sequence and Schematic set how it plays, sounds and reads. Every editor is free on the web, and
      each change is saved into the game, which picks it up.
    </p>
    <!-- The editor is a page of its own, not one of the site's routes, so the browser loads it whole. -->
    <p class="cta"><a class="button" href="/editor/app/" data-sveltekit-reload>Open the editors <Icon name="arrowRight" /></a></p>
    <p class="note">
      Nothing to install. Your games are saved in this browser, on this device, and nowhere else. Save a copy of a game any
      time to keep it safe or to move it, and Share sends a single level out as a file.
    </p>
  </header>

  <div class="pictures">
    {#each PICTURES as picture, index (picture.src)}
      <figure class:tall={picture.height > picture.width}>
        <picture>
          <source type="image/webp" srcset={webp(picture.src)} />
          <img
            src={picture.src}
            width={picture.width}
            height={picture.height}
            alt={picture.alt}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        </picture>
        <figcaption>{picture.caption}</figcaption>
      </figure>
    {/each}
  </div>

  <section class="own">
    <h2>On your own game</h2>
    <p>In your game's folder, this opens the same editors on your game, and every change goes straight into it.</p>
    <TerminalBox command={EDITOR_COMMAND} />
    <p><a href="/docs/editor">Draw levels in the editor</a> says more.</p>
  </section>
</div>

<style>
  .wrap {
    width: min(1120px, 100% - 2 * var(--side));
    margin: 0 auto;
    padding: 72px 0 112px;
  }
  .kicker {
    margin: 0;
    color: var(--faint);
    font: 500 13px/20px var(--font-mono);
  }
  h1 {
    margin: 12px 0 0;
    font-size: clamp(36px, 4vw, 56px);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }
  .lead {
    max-width: 620px;
    margin: 20px 0 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 28px;
  }
  .cta {
    margin: 32px 0 0;
  }
  .note {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  /* The wide picture spans the row; the two smaller ones share the row under it. */
  .pictures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    margin: 64px 0 0;
  }
  figure {
    min-width: 0;
    margin: 0;
  }
  figure:first-child {
    grid-column: 1 / -1;
  }
  picture {
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
  }
  img {
    display: block;
    width: 100%;
    height: auto;
  }
  /* The phone picture stands upright: as tall as its neighbour, not as wide. */
  .tall picture {
    aspect-ratio: 992 / 964;
  }
  .tall img {
    width: auto;
    height: 100%;
  }
  figcaption {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 15px;
  }
  .own {
    max-width: 720px;
    margin: 80px 0 0;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .own p {
    margin: 12px 0;
    color: var(--muted);
  }
  .own a {
    color: var(--ink);
    font-weight: 500;
  }
  @media (max-width: 760px) {
    .wrap {
      padding: 40px 0 72px;
    }
    .pictures {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
