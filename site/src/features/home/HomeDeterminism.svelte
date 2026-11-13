<script lang="ts">
// "Checks" (the docs call it determinism; Home does not, per the GTM research): the recorded run every engine the parity
// tests use has to end at the same hash of. The engines, the golden's name, its ticks and its hash are read from the workspace
// (`virtual:framework/facts`), not typed here; the table states the rule and claims no result, because a result is a CI run's.
import facts from 'virtual:framework/facts'
import Icon from '../../shared/components/Icon.svelte'
import { DETERMINISM } from './home-content'
</script>

<section class="home-section">
  <div class="page-wrap home-chess flip">
    <div class="text">
      <span class="home-kicker"><Icon name="check" size={14} />{DETERMINISM.kicker}</span>
      <h2>{DETERMINISM.title}</h2>
      <p class="home-sub">{DETERMINISM.sub}</p>
    </div>
    <div class="show home-panel">
      <div class="head"><span class="tab">{facts.golden.file}</span><span class="sp">{facts.golden.ticks} ticks</span></div>
      <table>
        <thead><tr><th scope="col">{DETERMINISM.columns.engine}</th><th scope="col">{DETERMINISM.columns.hash}</th><th scope="col" class="where">{DETERMINISM.columns.where}</th></tr></thead>
        <tbody>
          {#each facts.engines as engine (engine.id)}
            <tr>
              <th scope="row">{engine.name}</th>
              <td><code class="hash">{facts.golden.hash}</code></td>
              <td class="where">{engine.where}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  thead th {
    color: var(--faint);
    font: 500 12px/1 var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  tbody th {
    font-weight: 400;
  }
  tr:last-child > * {
    border-bottom: 0;
  }
  .where {
    color: var(--muted);
    font: 400 13px var(--font-mono);
  }
  thead .where {
    font: 500 12px/1 var(--font-mono);
    color: var(--faint);
  }
  .hash {
    color: var(--lime);
    font: 400 13px var(--font-mono);
  }
  @media (max-width: 760px) {
    .where {
      display: none;
    }
  }
</style>
