# Actors

A scripted actor is a character on a timeline. It can walk a path, turn, look at things, play actions, hold a stand, wear an expression and hold an item, each at a set time. An actor draws through a `Figure`, at any density, in any of the 8 views; `lightFigure` (`src/shared/lighting`) lights its frames.

Everything an actor shows at time `t` is a **pure function of `t`**. That covers where it is, which way it faces, its walk phase (worked out from the distance walked), each action's envelope, its blink and its hair. No clock runs inside the actor, so a cut, a second shot, a test or a scrubber can sample any moment in any order and get the same frame, down to the byte.

| File | What it holds |
|---|---|
| `src/shared/actors/actor.ts`, `actor-types.ts`, `actor-cast.ts` | `ScriptedActor`, `Troupe`, `ActorScript`, `characterOf`, `memberOf`, `Placement`, `scriptOf` |
| `src/shared/actors/actions.ts`, `actions.schema.ts` | the action generator: keys to spec, envelope, aliases, gait modes; the strict schema the action set loads through |
| `src/shared/actors/library/actions.json` | the action set and the run, as data |
| `src/shared/actors/pose-spec.ts` | the IK pose spec: a whole pose, or a layer over the gait; floor contact |
| `scripts/actors-demo.ts` | the contact sheet |

## Quick start

```ts
import { ScriptedActor, Troupe } from '@automata/figures';

// Alone, with its own Figure: a base id or a CharacterDef.
const a = new ScriptedActor({ who: 'base-f', at: [0, 0], facing: 30, actions: [{ t: 0.5, action: 'wave' }] }, { density: 2 });
const f = a.draw(1.2, { azimuth: 0, pitch: 18 * Math.PI / 180 }); // f.painted, f.normals, f.g
```

Actors that name each other as targets share a `Troupe`: `new Troupe()`, then `troupe.add(script, opts)`.

## The script (JSON or TS)

```jsonc
{
  "name": "A",                       // for other actors' targets; defaults to the character's id
  "who": "base-f",                   // a base id or a whole CharacterDef
  "outfit": "base",                  // optional; the character's default otherwise
  "at": [-4.2, 0.9],                 // start (floor x, z)
  "facing": 30,                      // degrees: 0 toward +z, 90 toward +x; defaults to its first waypoint
  "start": 0,                        // when it sets off along the path
  "path": [
    { "at": [-0.4, 1.3] },                         // at its gait's speed (stride per stance: the feet never slide)
    { "at": [2, 1.3], "speed": 0.8 },              // a speed in m/s (the cadence follows; the feet still plant)
    { "at": [5, 3], "run": true },                 // its own gait's run
    { "at": [5, 4], "gait": "strut" },           // any library gait
    { "at": [4, 4], "strafe": true },              // keeps its facing, steps sideways or back
    { "at": [4, 4.01], "march": 1.5 },             // steps in place 1.5 s on arrival
    { "at": [3, 4], "wait": 2 },                   // stands 2 s on arrival
    { "at": [0, 0], "stop": true }                 // the path ends here
  ],
  "face": [{ "t": 4, "to": 90 }, { "t": 6, "to": "B" }, { "t": 8, "to": [3, 3] }],
  "look": [{ "t": 1, "at": "B" }, { "t": 5, "at": [4, 1.2, -4] }, { "t": 7, "at": null }],
  "actions": [
    { "t": 1.0, "action": "wave" },
    { "t": 3.0, "action": "wave", "until": 6 },                // a looping action plays on to `until`
    { "t": 4.6, "action": "handshake", "at": "B" },
    { "t": 6.8, "action": "point", "at": [4, -4] },
    { "t": 8.0, "action": "sit", "seat": 0.45, "until": 12 },  // hold actions stay until `until`
    { "t": 9.4, "action": "attack", "side": "R" }              // a swing with an item, a punch without
  ],
  "stands": [{ "t": 0, "until": 2.6, "pose": "handInPocket" }],   // library/poses.json, while standing
  "expressions": [{ "t": 2.3, "is": "talk" }, { "t": 3.8, "is": "neutral" }],
  "items": [{ "t": 8.6, "hold": "torch" }, { "t": 12, "hold": null }]
}
```

### Rules

**Walking.** The body faces the way it walks. It turns at corners at 9 rad/s and toward face keys at 5 rad/s. A face key that falls during a walk takes effect when the walk ends. A strafe keeps the facing and turns the feet's paths by the heading (`MotionState.heading`). The walk's phase comes from the distance walked, quantised to the gait's `walkPoses`.

**Targets.** A target is one of:
- `[x, z]`: a place on the floor, at this actor's eye height;
- `[x, y, z]`: a world point, with `y` measured from the floor;
- an actor's name: that actor's eyes. For a handshake, the meeting point between the two actors, at waist height.

Targets that move are followed every frame.

**Looking.** A look turns the chest by up to 0.4 rad and the head by the rest, plus pitch. Past 1.45 rad the body turns with it. A look blends between keys over 0.35 s, and `null` releases it.

**Actions.**
- Each action has an envelope: **anticipation** (it blends in from the gait and reaches the wind-up), **action**, then **recovery** (it blends back to the gait).
- `upper` actions lie over whatever the gait is doing: you can wave while walking. Their hips can shift and turn, with the feet re-solved so they stay planted.
- `full` actions pose the whole body and keep it on the floor. Each pose is set down so its lowest point touches the floor, and blends keep the body grounded. A later full action ends an earlier one once it has blended in, so `fall` → `getUp` works.
- Actions play over a stand or a gait in the order they start.
- `reach` and `flinch` (the motion's own) also work as cues.

**Stands.** A stand blends in and out over 0.35 s. If the outfit doesn't suit the stand (`cast.ts fits`), its fallbacks are tried in turn, and `actor.standFor(name, figure).name` reports the stand actually used. Stands apply only while the actor is standing still.

**Item and expression.** Each holds from its key until the next key. The hand that holds an item is the character's `hand`. When an action names its hand as `either`, that means the free hand while an item is held.

## The action set (`src/shared/actors/library/actions.json`)

| id | body | what it does |
|---|---|---|
| `wave` | upper | hand by the head, the forearm wagging; loops to `until` |
| `point` | upper | arm straight at `at` (ahead without one), head and chest turned to it |
| `nod`, `shake` | upper | yes, no |
| `shrug` | upper | shoulders up, forearms out, head tipped |
| `look` | upper | head and chest to `at`; plays `lookAround` without a target |
| `lookAround` | upper | to one side, a beat, across to the other |
| `sit` | full, hold | hips back and down onto `seat` (default: knee height), feet under the knees, hands on the thighs |
| `kneel` | full, hold | on one knee, hand on the other |
| `crouch` | full, hold | low on both feet, forearms over the knees, head up |
| `hit` | full | head snapped back, chest thrown back, half a step back, settles |
| `fall` | full, hold | stagger, down on the seat, flat on the back |
| `ko` | full, hold | knees go, down on the seat, over onto the back, limp |
| `getUp` | full | from lying: sit up on the hands, onto one knee, stand |
| `swing` | upper (main hand) | wind up behind the shoulder, swing across, follow through; a held item swings with the hand |
| `punch` | upper (main hand) | chamber and guard, then a straight punch |
| `attack` | alias | `swing` while holding an item, `punch` without |
| `victory` | upper | dip, both arms up in a V, fists pumping; loops to `until` |
| `handshake` | upper (main hand) | hand to the point between two actors, two pumps (both actors play it, so the hands meet) |

The **run** is not an action. It is a mode of each figure's own gait (`modes.run`: scale and set numbers), so a character runs in its own manner. Any library gait can be named on a waypoint.

### The data format of an action

```jsonc
"wave": {
  "body": "upper",            // or "full"
  "hand": "either",           // "main" (the item hand), "free", or "either" (the main unless it holds an item)
  "anticipation": 0.3, "action": 1.2, "recovery": 0.4,
  "enter": 0.15,              // optional: blend in faster than the anticipation (0: at once)
  "hold": false,              // true: stays at its last key until `until`
  "loop": [0.3, 0.7],         // optional: keys that repeat while held longer
  "targeted": false, "untargeted": "lookAround",
  "keys": [[0.3, { /* spec */ }], [0.5, { /* spec */ }]]   // times in s; a neutral key is implied at 0
}
```

A **spec** (`pose-spec.ts Spec`) is written for the acting side. `A` is the acting arm and +x points toward its side; `B` is the other arm. A right-handed actor plays the spec's mirror image. Every field is optional:

| field | meaning |
|---|---|
| `pel`, `pelR` | pelvis shift (m at k = height / 1.62) and turn (pitch forward, yaw toward A, roll) |
| `hip` | hip height as a share of standing (0.5 kneels, 0.13 lies) |
| `seat` | 0–1 of the way to sitting on the seat |
| `chest`, `head` | turns (pitch forward/down, yaw toward A, roll) |
| `sh` | shoulders raised (rad) |
| `face` | 0–1 of the way the head and chest turn to the target |
| `A`, `B` | arm: `w` (how much the spec drives it; absent means the gait's arm), `d` (hand direction from the shoulder), `r` (share of the arm's length), `pole` (elbow direction), `to: "target" \| "meet"`, `bob` (m) |
| `fA`, `fB`, `stance` | full body only: each foot's `at` (in leg lengths: out, up, forward), `turn`, `pitch`; stance in hip widths |

Lengths scale with the body, so one spec fits every body the sliders make. Keys ease (smoothstep) into each other.

## The API

```ts
class ScriptedActor {
  constructor(script: ActorScript, opts?: { density?: number; troupe?: Troupe; ground?: (x, z) => number; cache?: boolean });
  readonly name: string; readonly def: CharacterDef; readonly member: CastMember;
  state(t): ActorState & { look }       // where it is, its facing, speed, moving, phase, gait, heading
  positionAt(t): [x, z]                  // reads no other actor
  poseAt(t, figure, view): Pose          // the pose (local, facing +z), for that figure's snapped view
  draw(t, view, density?): Figure        // the figure at that density brought to t (painted, normals, g)
  activeAt(t)                            // the actions playing and their weights
  standFor(name, figure)                 // the stand actually used, after the outfit's fallbacks
  itemAt(t); expressionAt(t); standAt(t);
  speedOf(gait); gaitOf(waypoint);
}
class Troupe { add(script, opts?): ScriptedActor; get(name) }
characterOf(who) → { def, pose? }; memberOf(def, density) → CastMember   // cast.ts memberOf, re-exported; the public surface calls it `member`
// actions.ts
actionOf(id, holdsItem, hasTarget) → { id, def }; specAt(def, u, duration); weightAt(def, u, duration);
envelopeOf(def, duration); lengthOf(def); modeGait(gait, 'run')
// pose-spec.ts
fill(spec); mix(a, b, k); specPose(skeleton, filled, side, aims, tip); layer(skeleton, evaluated, filled, side, w, aims);
blend(a, b, k); lowest(skeleton, world)
```

### Hooks in the figure

Each is optional, and the review frames don't set it, so every sprite stays byte-identical (`tests/unit/actors/actors.test.ts` checks the base pair at D1 and D2, every channel of every pixel, against `tests/unit/golden/sprites.json`, and `tests/unit/golden/actors.test.ts` checks 294 actor frames against `tests/unit/golden/actors.json`).

- `FigureInput.clock`: sets the figure's clock from outside, so idle, blink and talk are a function of it.
- `Figure.snap(facing, view)`: the view snap, factored out of `update`.
- `Figure.clockAt(time)`: the idle clock, factored out of `update`.
- `MotionState.heading`: a strafe, the feet's paths turned off the facing.
- `MotionState.stride`: the stride's share; 0 steps in place.

### Placements

A `Placement` `{ who, at, to, facing, pose }` is the short form of a script, and `scriptOf` turns it into one:
- `to` becomes one waypoint at the gait's speed;
- `pose` becomes a stand from t = 0 (`'hero'` uses the character's own lookbook stand).

## Demo

```sh
pnpm --filter @automata/figures actors -- OUT_DIR
```

This writes `actions-sheet.png` and its `-x2`: each action at five moments (start, wind-up, action, end, recovery) on `base-m` and `base-f`, plus the run, the strafe and stepping in place, at D2.

## Weak spots

- **Hand shapes.** Hands stay straight along the forearm. A wave shows the hand's edge, not the palm, and a punch has no clenched fist.
- **Foreshortening.** A point or punch aimed at the camera reads poorly at sprite size. Stage them in three-quarter view.
- **Lying down.** Floor contact uses a joint-and-radius model of the body, not the mesh. A lying body can sink a texel into the floor or hover one above it.
- **Fall recovery.** A `fall` or `ko` that ends without a `getUp` blends straight back to standing, which looks like levitation. Script a `getUp`.
- **Handshake.** Both actors must play the handshake, and each hand reaches a point between them, not the other hand.
- **Strafe and look overflow.** A look past the neck while walking turns the body and makes the walk strafe. That is fine for a glance, odd for a long one.
- **No collision.** Actors walk through each other and through props. Paths are the script's job.
