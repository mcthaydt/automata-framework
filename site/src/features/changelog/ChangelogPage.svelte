<!--
  /changelog: every change waiting for the first release, read from the repository's changesets
  (`virtual:framework/changelog`). The page keeps no entry of its own, so it cannot say a change the code does not have.
-->
<script lang="ts">
import changelog from 'virtual:framework/changelog'
import PageShell from '../../shared/components/PageShell.svelte'
</script>

<PageShell>
  <header>
    <p class="kicker">Changelog</p>
    <h1>What is landing in the first release.</h1>
    <p class="lead">
      Automata has not had its first release yet. These are the changes waiting for it, each one a real change in the
      repository.
    </p>
  </header>

  <ul class="entries">
    {#each changelog as entry (entry.id)}
      <li id={entry.id}>
        {#if entry.date}<span class="date">{entry.date}</span>{/if}
        <h2>{entry.title}</h2>
        {#if entry.packages.length > 0}<p class="packages">{entry.packages.join(', ')}</p>{/if}
      </li>
    {/each}
  </ul>
</PageShell>

<style>
  .kicker {
    margin: 0;
    color: var(--lime);
    font: 500 13px / 16px var(--font-mono);
  }
  header h1 {
    margin-top: 12px;
  }
  .entries {
    margin: 48px 0 0;
    padding: 0;
    border-top: 1px solid var(--line);
    list-style: none;
  }
  .entries li {
    margin: 0;
    padding: 24px 0;
    border-bottom: 1px solid var(--line);
  }
  .date {
    color: var(--faint);
    font: 400 13px / 1 var(--font-mono);
  }
  h2 {
    margin: 8px 0 0;
    font-size: 20px;
    line-height: 1.3;
    letter-spacing: -0.015em;
  }
  .packages {
    margin: 8px 0 0;
    color: var(--faint);
    font: 400 13px / 20px var(--font-mono);
  }
</style>
