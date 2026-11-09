<script lang="ts">
// The numbers row: plain facts about the framework, each read from the workspace (`virtual:framework/facts`) and not
// typed here, so the page cannot say a count the repository does not back.
import facts from 'virtual:framework/facts'
import { FACT_WORDS, TARGETS } from './home-content'

const row = [
  { number: `${facts.engines.length} engines`, words: FACT_WORDS.engines },
  { number: `${facts.examples} examples`, words: FACT_WORDS.examples },
  { number: `${TARGETS.length} targets`, words: FACT_WORDS.targets },
  { number: facts.licence, words: FACT_WORDS.licence },
]
</script>

<div class="facts">
  <dl class="page-wrap">
    {#each row as fact (fact.words)}
      <div class="fact"><dt>{fact.number}</dt><dd>{fact.words}</dd></div>
    {/each}
  </dl>
</div>

<style>
  .facts {
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 0 auto;
  }
  .fact {
    padding: 28px 24px;
  }
  .fact:first-child {
    padding-left: 0;
  }
  .fact + .fact {
    border-left: 1px solid var(--line);
  }
  dt {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }
  dd {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 20px;
  }
  @media (max-width: 760px) {
    dl {
      grid-template-columns: 1fr 1fr;
    }
    dt {
      font-size: 24px;
    }
    .fact {
      padding: 20px 0;
    }
    .fact + .fact {
      border-left: 0;
    }
    .fact:nth-child(even) {
      padding-left: 16px;
      border-left: 1px solid var(--line);
    }
    .fact:nth-child(n + 3) {
      border-top: 1px solid var(--line);
    }
  }
</style>
