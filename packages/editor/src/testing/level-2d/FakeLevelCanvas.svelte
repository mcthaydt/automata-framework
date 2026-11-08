<!--
  A stand-in for the Pixi level canvas in jsdom, which has no WebGL (plan ED2D.4c4a). It shows what it was handed, so a
  DOM test can read the level, the layer, the tool and the camera the Level view passed down.
-->
<script lang="ts">
import type { LevelCanvasProps } from '../../shared/level-2d/session/view-props'

const { view, camera }: LevelCanvasProps = $props()
</script>

<div
  data-testid="fake-canvas"
  data-level={view.level}
  data-layer={view.layer}
  data-tool={view.tool}
  data-camera={camera === undefined ? '' : `${camera.x},${camera.y},${camera.scale}`}
></div>
