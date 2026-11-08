// The Walk view's controller as the views reach it (ED3D.8b): the headless walker lives in `view/walk`, and `ui/` reaches the
// editor through `app/` (the architecture test), so this is the one door.
export {
  createWalkController,
  type Stick,
  type WalkController,
  type WalkMode,
  type WalkView,
} from './walk-controller'
