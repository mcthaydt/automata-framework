<!-- A character on the canvas. Its diagram and list of switches are built on this in the next step. -->
<script lang="ts">
import type { AgentDef } from '@automata/systems/sim'
import { modeWords } from './pieces/piece.ts'

const { character }: { character: AgentDef } = $props()
</script>

<h2>{modeWords(character.id)}</h2>
<p>Starts in {modeWords(character.initial)}.</p>
