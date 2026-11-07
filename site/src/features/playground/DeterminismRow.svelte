<script lang="ts">
import { type DeterminismView, determinismText } from './determinism'

// The determinism row under the preview (spec §13): whether this run replayed to the framework's recorded hash. It is
// for developers, so it sits folded under "For developers"; a divergence is a cross-engine bug to report, so it opens
// itself and speaks as an alert.
let { view, exampleId }: { view: DeterminismView; exampleId: string } = $props()
</script>
<details class="determinism" open={view.kind === 'diverged'}>
  <summary>For developers</summary>
  <p class="determinism-row" role={view.kind === 'diverged' ? 'alert' : undefined}>{determinismText(view, exampleId)}</p>
</details>
<style>
  .determinism { margin: .5rem 0 0; font-size: var(--step-small); color: var(--muted); }
  .determinism summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .determinism-row { margin: 0; overflow-wrap: anywhere; }
  .determinism-row[role='alert'] { color: var(--text); font-weight: 600; }
</style>
