<!--
  The smallest component of this package that stands inside the kit's shell: it proves the Svelte toolchain
  (compile, the kit's components, runes, the geometry stand-in) before real screens exist.
-->
<script lang="ts">
import type { GeometryState } from '@automataframework/automata'
import { EditorShell } from '@automataframework/automata-editor/kit'

let { geometry }: { geometry: GeometryState } = $props()
</script>

<EditorShell {geometry}>
  {#snippet topbar()}<h1>Probe</h1>{/snippet}
  {#snippet canvas()}<p>canvas</p>{/snippet}
</EditorShell>
