<!--
  Home, from the approved mockup (2026-11-06): one claim and the game it makes, three reasons, real code beside what
  it draws, the editor, the four places a game goes, and one closing ask. One lime button per screen (Make a game);
  everything else is the white secondary or a plain link. Every claim is something the framework does today
  (`home-content.ts` holds them, and its test holds them to the framework). Each section is a component of its own.
-->
<script lang="ts">
import Icon from '../../shared/components/Icon.svelte'
import './home.css'
import HomeCode from './HomeCode.svelte'
import HomeEditor from './HomeEditor.svelte'
import HomeHero from './HomeHero.svelte'
import HomeStart from './HomeStart.svelte'
import HomeTargets from './HomeTargets.svelte'
import { REASONS } from './home-content'
</script>

<HomeHero />

<section class="home-section">
  <div class="page-wrap">
    <p class="home-kicker">Why Automata</p>
    <h2>A game your agent can change without breaking it.</h2>
    <div class="reasons">
      {#each REASONS as reason (reason.title)}
        <div class="reason">
          <span class="home-icon"><Icon name={reason.icon} size={18} /></span>
          <h3>{reason.title}</h3>
          <p>{reason.body}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<HomeCode />
<HomeEditor />
<HomeTargets />
<HomeStart />

<style>
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
  .reason p {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 24px;
  }
  @media (max-width: 760px) {
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
  }
</style>
