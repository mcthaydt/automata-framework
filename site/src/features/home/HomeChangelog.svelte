<script lang="ts">
// "Changelog": the latest changes, read from the changesets that wait for the first release (`virtual:framework/changelog`),
// so the list is the repository's, not text kept here. The first release has not shipped, so the title says what the
// list is: what lands in it, never "shipped".
import changelog from 'virtual:framework/changelog'
import Icon from '../../shared/components/Icon.svelte'
import { CHANGELOG_SECTION } from './home-content'

const latest = changelog.slice(0, CHANGELOG_SECTION.count)
</script>

{#if latest.length > 0}
  <section class="home-section">
    <div class="page-wrap">
      <div class="home-more">
        <div>
          <span class="home-kicker"><Icon name="list" size={14} />{CHANGELOG_SECTION.kicker}</span>
          <h2>{CHANGELOG_SECTION.title}</h2>
        </div>
        <a class="home-secondary" href="/changelog">{CHANGELOG_SECTION.all} <Icon name="arrowRight" /></a>
      </div>
      <ul class="log">
        {#each latest as entry (entry.id)}
          <li>
            <a href="/changelog#{entry.id}">
              {#if entry.date}<span class="date">{entry.date}</span>{/if}
              <span class="title">{entry.title}</span>
              <Icon name="arrowRight" size={16} />
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<style>
  .log {
    margin: 48px 0 0;
    padding: 0;
    border-top: 1px solid var(--line);
    list-style: none;
  }
  .log li {
    margin: 0;
    border-bottom: 1px solid var(--line);
  }
  .log a {
    display: grid;
    grid-template-columns: 1fr 20px;
    gap: 4px 24px;
    align-items: center;
    min-height: 64px;
    padding: 12px 0;
    text-decoration: none;
  }
  .log a:has(.date) {
    grid-template-columns: 140px 1fr 20px;
  }
  .log a:hover .title {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .date {
    color: var(--faint);
    font: 400 13px / 1 var(--font-mono);
  }
  .title {
    font-size: 16px;
  }
  .log :global(svg) {
    color: var(--faint);
  }
  @media (max-width: 760px) {
    .log a:has(.date) {
      grid-template-columns: 1fr 20px;
    }
    .date {
      grid-column: 1 / -1;
    }
  }
</style>
