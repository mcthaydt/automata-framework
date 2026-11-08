<script lang="ts">
import { type DeterminismView, determinismText } from './determinism'

// The determinism row under the preview (spec §13). A divergence is an alert: a cross-engine bug to report.
let { view, exampleId }: { view: DeterminismView; exampleId: string } = $props()
</script>
<p class="determinism-row" role={view.kind === 'diverged' ? 'alert' : undefined}>{determinismText(view, exampleId)}</p>
<style>
  .determinism-row { margin: .5rem 0 0; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  .determinism-row[role='alert'] { color: var(--text); font-weight: 600; }
</style>
