<script lang="ts">
import { type DeterminismView, determinismText } from './determinism'

// The determinism row under the preview (spec §13). It is for developers, so it sits behind a disclosure; a divergence
// is an alert (a cross-engine bug to report), so then it is open.
let { view, exampleId }: { view: DeterminismView; exampleId: string } = $props()
</script>
<details class="determinism" open={view.kind === 'diverged'}>
  <summary>For developers: does this replay the same?</summary>
  <p class="determinism-row" role={view.kind === 'diverged' ? 'alert' : undefined}>{determinismText(view, exampleId)}</p>
</details>
<style>
  .determinism { margin: .5rem 0 0; font-size: var(--step-small); color: var(--muted); }
  .determinism summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  .determinism-row { margin: 0; overflow-wrap: anywhere; }
  .determinism-row[role='alert'] { color: var(--text); font-weight: 600; }
</style>
