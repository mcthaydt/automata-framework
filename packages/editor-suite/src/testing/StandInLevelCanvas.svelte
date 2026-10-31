<!-- The 2D level canvas in jsdom, which has no WebGL (plan EDS.2d): it shows the level, layer, tool and selection it was handed. -->
<script lang="ts">
import type { LevelCanvasProps } from '@mcthaydt/automata-editor-2d/suite'

const { view }: LevelCanvasProps = $props()
</script>

<div data-testid="level-canvas" data-level={view.level} data-layer={view.layer} data-tool={view.tool} data-selected={view.selected.join(' ')}></div>
