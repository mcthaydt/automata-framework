<!--
  A stand-in for the Pixi world canvas in jsdom, which has no WebGL. It shows what it was handed, so a
  DOM test can read the levels, the selection, the links and the camera the World view passed down.
-->
<script lang="ts">
import type { WorldCanvasProps } from '../../features/document/view-props'

const { rects, camera, links }: WorldCanvasProps = $props()
</script>

<div
  data-testid="fake-world-canvas"
  data-levels={rects.map((rect) => `${rect.id}@${rect.x},${rect.y}`).join(' ')}
  data-selected={rects.find((rect) => rect.selected)?.id ?? ''}
  data-links={links.map((link) => `${link.from}>${link.to}`).join(' ')}
  data-camera={`${camera.x},${camera.y},${camera.scale}`}
></div>
