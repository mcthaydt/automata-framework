# Physics

Things that fall, bounce and bump, in 2D or 3D, inside the simulation. Rapier does the work, and the same seed and
inputs give the same result in every browser. Your game never imports Rapier itself.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

Add the plugin for the dimension you play in to the game's sim:

```ts
import { physics2d } from '@automata/physics/2d'

export default defineGame({ sim: { plugins: [physics2d({ gravity: { x: 0, y: -9.81 } })] } })
```

For 3D, import `physics3d` from `@automata/physics/3d` the same way. Gravity is part of the game's identity: a
different gravity is a different game, and an old save will not load into it.

## What you get

- **Bodies and colliders** as components: `RigidBody2D`, `Collider2D`, `Transform2D` (and the `3D` ones), with
  `body2d`, `collider2d` and `transform2d` to build them when you spawn something.
- **Collision events** your systems can read: `CollisionStarted2D` and `CollisionEnded2D` (and the `3D` ones).
- **Shapes and body kinds** (`ShapeKind`, `BodyKind`): fixed, moving or pushed by the sim.
