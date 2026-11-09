<script lang="ts">
// "Checks" (the docs call it determinism; Home does not, per the GTM research): the same recorded run in every engine the parity tests use. The rows are the workspace's own list
// of engines (`virtual:framework/facts`), not typed here.
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
      <div class="head"><span class="tab">{DETERMINISM.file}</span><span class="sp">{DETERMINISM.note}</span></div>
      <table>
        <thead><tr><th scope="col">Engine</th><th scope="col">Result</th><th scope="col" class="where">Where</th></tr></thead>
        <tbody>
          {#each facts.engines as engine (engine.id)}
            <tr>
              <th scope="row">{engine.name}</th>
              <td><span class="pass"><Icon name="check" size={14} />{DETERMINISM.result}</span></td>
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
  .pass {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--lime);
    font-weight: 500;
  }
  @media (max-width: 760px) {
    .where {
      display: none;
    }
  }
</style>
