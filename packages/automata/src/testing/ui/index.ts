/**
 * The layout contract for a game's own screens, part of `@automata/framework/testing`: publish the geometry for a reference size and variant, mount the
 * screen, `settleLayout`, then `checkLayout`. A screen without CornerControls marks its way out with
 * `data-way-out` so the contract keeps it reachable.
 */
export {
  byTestId,
  type Conditions,
  checkLayout,
  errorPanelFloor,
  publishConditions,
  type Targets,
  TOUCH_TARGETS,
} from './layout-contract'
export { mountInPlay, type PlayMount } from './play-host'
export { settleLayout } from './settle'
