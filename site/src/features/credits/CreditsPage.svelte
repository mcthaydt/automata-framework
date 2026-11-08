<!--
  /credits: the open-source work Automata stands on, in the Home v2 look. Everything it lists comes from
  credits-data.ts, which a test holds to the workspace's manifests. Each row is the name (a link to its home), one
  plain line about what it does for a game, and its licence as the project states it. The links go to other sites and
  open only when the visitor chooses them, so the Privacy page's "no requests to other sites" stays true.
-->
<script lang="ts">
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import { CONTACT_EMAIL } from '../../shared/site.js'
import { CREDIT_GROUPS, CREDITS } from './credits-data'
</script>

<PageMeta
  title="Credits"
  description="The open-source projects Automata is built on, what each one does and its licence: PixiJS, Pixi 3D, Koota, Klipp, Rapier, Svelte, Tauri and more."
/>
<PageShell wide>
  <header>
    <p class="kicker">Credits</p>
    <h1>Built on open source</h1>
    <p class="lead">
      Automata only exists because other people shared their work. Thank you to every one of them. Here is what we use,
      what it does for your game, and the licence it comes with.
    </p>
  </header>

  {#each CREDIT_GROUPS as group (group.id)}
    <section class="group" aria-labelledby={'group-' + group.id}>
      <h2 id={'group-' + group.id}>{group.title}</h2>
      <p class="intro">{group.intro}</p>
      <ul>
        {#each CREDITS.filter((credit) => credit.group === group.id) as credit (credit.name)}
          <li>
            <a class="name" href={credit.url} rel="noopener noreferrer">{credit.name}</a>
            <span class="what">{credit.what}</span>
            <span class="licence">{credit.licence}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <section class="note">
    <h2>Their licences stay theirs</h2>
    <p>
      Automata’s own code is MIT. Each project above keeps its own licence, and ours does not replace it. Did we miss
      someone we should thank? Write to <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
    </p>
  </section>
</PageShell>

<style>
  header {
    margin-bottom: 48px;
  }
  .kicker {
    margin: 0 0 8px;
    color: var(--lime);
    font-size: 13px;
    font-weight: 600;
  }
  .lead {
    max-width: 40rem;
  }
  .group {
    margin-top: 56px;
  }
  .group h2 {
    margin: 0;
  }
  .intro {
    margin: 4px 0 16px;
    color: var(--muted);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }
  li {
    display: grid;
    grid-template-columns: minmax(9rem, 14rem) 1fr auto;
    align-items: center;
    column-gap: 24px;
    min-height: 56px;
    padding-block: 6px;
    border-bottom: 1px solid var(--line);
  }
  .name {
    display: flex;
    align-items: center;
    min-height: 44px;
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
  }
  .name:hover {
    text-decoration: underline;
  }
  .what {
    color: var(--muted);
  }
  .licence {
    color: var(--faint);
    font-family: var(--font-mono);
    font-size: 13px;
    text-align: right;
  }
  .note {
    margin-top: 64px;
    max-width: 40rem;
  }
  @media (max-width: 760px) {
    li {
      grid-template-columns: 1fr auto;
      row-gap: 0;
    }
    .what {
      grid-column: 1 / -1;
      order: 3;
      padding-bottom: 8px;
    }
  }
</style>
