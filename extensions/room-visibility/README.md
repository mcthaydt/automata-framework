# Room visibility

An angled-camera level shows the player one room and what the camera sees past it. This extension decides which rooms
draw: a policy names the rooms, the rooms each camera zone sees, and who owns each solid mass, and a wall can be cut away
from a zone. It hides what a zone should not see, and it never decides anything about the game: presentation only.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing. It is not published to npm yet,
because it builds on `@automata/3d`.

## The policy

```ts
import { parseRoomPolicy } from '@automata/room-visibility'

const policy = parseRoomPolicy({
  rooms: { reception: ['hall', 'counter'], ward: ['ward'], corridor: ['corridor'] }, // sector ids
  zones: { hall: ['reception', 'ward', 'corridor'], corridor: ['corridor'] },        // what each zone sees
  masses: { 0: ['reception', 'ward'], 1: 'global' },                                // owners by mass index
})
```

`checkRoomPolicy(policy, { sectors, zones, massCount })` returns, in words, everything the policy and the level disagree
about: a sector in no room or in two, a zone with no rooms, a room that is not there, a mass nobody owns. It returns a list
and never throws.

## Which rooms draw

`createRoomVisibility(policy, plansOf(level))` takes an `af-sector/2` level's sectors (any data of that shape) and each
frame answers `update({ zone, at, dt, reducedMotion, cutscene, also })` with the set of rooms to draw:

- the rooms the camera's zone sees;
- the room the player stands in, so a threshold never hides the player;
- the zone just left, for 0.35 s after a change, so the cut does not pop a room out under the camera's blend (a player who
  asked for reduced motion gets the new zone at once);
- the room at `also`, the far side of a peek;
- every room in a cutscene.

## Walls

A wall's `cut` names its cutaway group (a wall with none is a group of its own) and `hideFrom: ['hall']` says the camera
zones that always cut it away. `wallGroups(level)` gathers the groups, `hiddenWallGroups(groups, zone, cutscene)` says which
a zone hides, and `wallRoomOwners(edges, rooms, point)` finds the rooms of the span of wall nearest a point. Ownership
follows the real span, not the group's name, because one cut id can run through unrelated rooms.

## In the 3D scene

`@automata/room-visibility/view` loads the renderer:

```ts
import { createRoomOwnership, createWallHider } from '@automata/room-visibility/view'

const owned = createRoomOwnership(view.root, policy)
const layer = owned.layer(['ward']) // an owned child of the root: draw the ward's content into it
owned.own(view.camera, 'global')    // the camera and the lights belong to every room
owned.assertComplete()              // throws, naming it, if any content has no room
owned.apply(rooms)                  // every frame: the rooms to draw
```

Each room's content sits under an identity parent, so the room's visibility never fights a lamp, a door or a fading wall
that toggles its own. `createWallHider()` takes the meshes of each cutaway group (`wallGroupAt` finds a drawn wall's group
from its line on the plan) and `apply(hiddenWallGroups(...))` hides them.

## See it

[`examples/3d/roomvisibility/roomvisibility-zones.ts`](../../examples/3d/roomvisibility/roomvisibility-zones.ts) draws three
rooms and a bulkhead. Press 1, 2 and 3 for the zones and V to switch the extension off; `?pref=webgpu` draws it on WebGPU.
The pictures are in [`docs/refactor/tll-extensions/`](../../docs/refactor/tll-extensions/).
