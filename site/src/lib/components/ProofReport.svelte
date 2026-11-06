<script lang="ts">
  import { ENGINE_NAMES, type Evidence } from '$lib/evidence'
  // Everything here is read from the evidence file the framework's CI wrote (DX spec §3.10). Nothing is typed by hand:
  // tests/audit-regressions.test.ts fails the build if a page hard-codes a hash that file records.
  let { evidence }: { evidence: Evidence } = $props()
  const revision = $derived(evidence.revision.sha.slice(0, 7))
  const generated = $derived(evidence.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC')
</script>

<section class="proof-source" aria-labelledby="proof-source-title">
  <h2 id="proof-source-title">Where these numbers come from</h2>
  <p>
    The framework’s CI is configured to write this file in its parity job on each push to <code>main</code>
    (<a href={`https://github.com/mcthaydt/automata-framework/blob/${evidence.revision.sha}/.github/workflows/ci.yml`}>ci.yml</a>).
    This copy is from revision <code>{revision}</code>, {generated}.
    {#if evidence.run.kind === 'ci'}<a href={evidence.run.url}>CI run {evidence.run.id}</a>, the {evidence.run.workflow} workflow’s {evidence.run.job} job,{/if}
    drove Chromium, Firefox and WebKit with Playwright {evidence.playwright}; Node ran the same scenarios directly.
  </p>
</section>

<section aria-labelledby="proof-goldens-title">
  <h2 id="proof-goldens-title">Same hash in every engine</h2>
  <p>
    Each scenario runs the same code, content, seed and commands for a fixed number of ticks, then hashes the simulation
    state. A game’s result is deterministic across engines when the four hashes below are equal.
  </p>
  <div class="proof-goldens">
    {#each evidence.goldens as golden (golden.scenario)}
      <section class="proof-golden" aria-label={golden.scenario}>
        <h3>{golden.scenario}</h3>
        <p class="proof-meta">Seed {golden.seed} · {golden.ticks} ticks</p>
        <table>
          <thead><tr><th scope="col">Engine</th><th scope="col">Hash</th></tr></thead>
          <tbody>
            {#each golden.hashes as entry (entry.engine)}
              <tr><th scope="row">{ENGINE_NAMES[entry.engine]}<span class="proof-version">{entry.version}</span></th><td><code class="hash">{entry.hash}</code></td></tr>
            {/each}
          </tbody>
        </table>
        <p class={golden.enginesAgree ? 'proof-verdict' : 'proof-verdict proof-verdict-bad'}>
          {golden.enginesAgree ? 'All four engines agree.' : 'The engines disagree.'}
        </p>
        <p class="proof-sources">Run by {#each golden.sources as source, index}{index > 0 ? ', ' : ''}<code>{source}</code>{/each}</p>
      </section>
    {/each}
  </div>
</section>

<section aria-labelledby="proof-packages-title">
  <h2 id="proof-packages-title">Packages</h2>
  <p>The version in each package’s manifest at this revision, and whether that version has a release tag.</p>
  <table aria-label="Published packages">
    <thead><tr><th scope="col">Package</th><th scope="col">Version</th><th scope="col">Release</th></tr></thead>
    <tbody>
      {#each evidence.packages as pkg (pkg.name)}
        <tr><th scope="row"><code>{pkg.name}</code></th><td>{pkg.version}</td><td>{pkg.released ? 'released' : 'not released'}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<section aria-labelledby="proof-check-title">
  <h2 id="proof-check-title">Not proved yet</h2>
  <p>
    {evidence.automataCheck.note}
    Waiting on {evidence.automataCheck.waitingOn.join(' and ')}.
  </p>
</section>
