# What the converter could not express, and what was done

`tools/convert/convert.ts` ran once, on 2026-11-11, from October's fixtures (content, not code) and a read-only checkout
of the game's old repository at `92e6704` (for where the furniture stands and how lines are said). Its output was
committed, and then edited by hand where the rows below say so; from that commit the files in `content/` are the
source, edited by hand and in the editors. The converter is kept as a record and refuses to write over content
without `--force`.

Each row is a thing the old data had that the new files could not say, with what was done. `dropped` is left out,
`approximated` is written as something near it, `left-for-hand` is for a person to finish.

## The report

| Kind | Where | What | Done |
| --- | --- | --- | --- |
| camera | hall | enter (shift on entering the zone): the views carry an enter margin instead | dropped |
| camera | corridor | enter (shift on entering the zone): the views carry an enter margin instead | dropped |
| camera | corridor | area (the zone’s bounds in x and z): the room it names says where it holds | dropped |
| camera | closet | area (the zone’s bounds in x and z): the room it names says where it holds | dropped |
| wall-member | room mouth, corner 1 | hideFrom ["hall"]: the level format has no per-room wall hiding; the rooms a view draws say it | dropped |
| hotspot | scratches | act one's hotspot that the prologue hides | dropped |
| hotspot | puddle | act one's hotspot that the prologue hides | dropped |
| hotspot | scrawl | act one's hotspot that the prologue hides | dropped |
| hotspot | bed | on "box:bed": a hotspot stands where it is, not on a box | dropped |
| hotspot | nightstand | on "box:nightstand": a hotspot stands where it is, not on a box | dropped |
| hotspot | sink | on "box:sink": a hotspot stands where it is, not on a box | dropped |
| hotspot | trolley | on "box:trolley": a hotspot stands where it is, not on a box | dropped |
| hotspot | closetDoor | on "box:closetDoor": a hotspot stands where it is, not on a box | dropped |
| hotspot | shelf | on "box:shelf": a hotspot stands where it is, not on a box | dropped |
| hotspot | exit | on "box:exit": a hotspot stands where it is, not on a box | dropped |
| prop | coat-hook | no generator draws "coat-hook"; written as a box of its size | approximated |
| prop | wall-sconce | no generator draws "wall-sconce"; written as a box of its size | approximated |
| prop | extinguisher-cabinet | no generator draws "extinguisher-cabinet"; written as a box of its size | approximated |
| prop | strip-light-1 | no generator draws "strip-light"; written as a box of its size | approximated |
| prop | strip-light-2 | no generator draws "strip-light"; written as a box of its size | approximated |
| prop | stock-boxes-1 | no generator draws "stock-boxes"; written as a box of its size | approximated |
| prop | stock-archive-1 | no generator draws "stock-archive"; written as a box of its size | approximated |
| prop | stock-linen-1 | no generator draws "stock-linen"; written as a box of its size | approximated |
| prop | stock-bottles-1 | no generator draws "stock-bottles"; written as a box of its size | approximated |
| prop | stock-canisters-1 | no generator draws "stock-canisters"; written as a box of its size | approximated |
| prop | stock-toolbox-1 | no generator draws "stock-toolbox"; written as a box of its size | approximated |
| prop | stock-rolls-1 | no generator draws "stock-rolls"; written as a box of its size | approximated |
| prop | stock-bandages-1 | no generator draws "stock-bandages"; written as a box of its size | approximated |
| prop | stock-archive-2 | no generator draws "stock-archive"; written as a box of its size | approximated |
| prop | stock-bandages-2 | no generator draws "stock-bandages"; written as a box of its size | approximated |
| prop | stock-bottles-2 | no generator draws "stock-bottles"; written as a box of its size | approximated |
| prop | stock-boxes-2 | no generator draws "stock-boxes"; written as a box of its size | approximated |
| prop | stock-linen-2 | no generator draws "stock-linen"; written as a box of its size | approximated |
| prop | stock-rolls-2 | no generator draws "stock-rolls"; written as a box of its size | approximated |
| prop | stock-canisters-2 | no generator draws "stock-canisters"; written as a box of its size | approximated |
| prop | stock-linen-3 | no generator draws "stock-linen"; written as a box of its size | approximated |
| prop | stock-boxes-3 | no generator draws "stock-boxes"; written as a box of its size | approximated |
| prop | stock-toolbox-2 | no generator draws "stock-toolbox"; written as a box of its size | approximated |
| lamp-radius | deskLamp | pool radius 1.7 m: a lamp's pool is its range now | dropped |
| lamp-kind | monitorGlow | the kit has no "screen" lamp; written as "bulb" with its own colour | approximated |
| lamp-radius | hallLamp | pool radius 3.4 m: a lamp's pool is its range now | dropped |
| lamp-radius | wardLamp | pool radius 2.6 m: a lamp's pool is its range now | dropped |
| lamp-radius | corridorLamp | pool radius 2.6 m: a lamp's pool is its range now | dropped |
| lamp-radius | exitLamp | pool radius 1.8 m: a lamp's pool is its range now | dropped |
| lamp-radius | closetLamp | pool radius 2.2 m: a lamp's pool is its range now | dropped |
| lamp-kind | curtainWest | the kit has no "fire" lamp; written as "bulb" with its own colour | approximated |
| lamp-radius | curtainWest | pool radius 3.2 m: a lamp's pool is its range now | dropped |
| lamp-kind | curtainEast | the kit has no "fire" lamp; written as "bulb" with its own colour | approximated |
| lamp-radius | curtainEast | pool radius 3.2 m: a lamp's pool is its range now | dropped |
| lamp-kind | spark | the kit has no "spark" lamp; written as "bulb" with its own colour | approximated |
| bounce | level | the bounce points of the old baked light: the lit room bakes its own | dropped |
| nav | patrol | the patrol of 12 stops: the creature's rules own its route now | dropped |
| delivery | prologue.bedBare | a pause inside a sentence | approximated |
| delivery | prologue.bedWait | a pause inside a sentence | approximated |
| delivery | prologue.curtain | a pause inside a sentence | approximated |
| delivery | prologue.sink | a pause inside a sentence | approximated |
| delivery | prologue.sink | 1 emphasis mark(s): the words carry no markup now | dropped |
| delivery | prologue.nightstandMore | 1 emphasis mark(s): the words carry no markup now | dropped |
| delivery | prologue.doorLocked | a pause inside a sentence | approximated |
| delivery | prologue.shelfDark | a pause inside a sentence | approximated |
| delivery | prologue.combineFluid | a pause inside a sentence | approximated |
| delivery | prologue.item.handLamp | a pause inside a sentence | approximated |
| cutscene | found | the old step to 0.9 m beside Ada (moved, clearSpot, sees) and the lens fitted to distance (fit) | dropped |
| systems | rule R15 | Light costs fuel: the lit lamp burns its paraffin. | dropped |
| systems | rule footsteps | Ada's footsteps make a small noise every 0.45 s while she walks. | dropped |
| systems | matrix light × tool:handLamp | cited the dropped rule R15 | approximated |
| systems | chase | 5 call(s) written as goTo = "player" | approximated |
| systems | fleeGoal | 1 call(s) written as flee = "light" | approximated |

## What was done by hand after the converter ran

- **The puzzle names three hotspots the level does not have** (`scratches`, `puddle`, `scrawl`: act one's, which the
  prologue hides). The check in `tests/unit/content/solver.test.ts` found them; their three `[hotspots.*]` entries are
  removed from `content/puzzles/prologue.toml`. No action of the puzzle is at any of them.
- **The creature still calls `replan`.** The old game's re-route on a clock is the systems extension's
  `followPlayer(every)`, a hook the night feature answers (task 12), not something the file can say, so the file keeps
  the call. The plan listed four calls; five are named (`tests/unit/content/calls.test.ts`).
- **A matrix cell cited the dropped fuel rule.** It is now a `cut` saying the lamp feature burns the paraffin.
- **The level has no wall that hides itself from a room, no lamp pool radius and no bounce points.** The rooms a view
  draws (`views.*.rooms`, task 13) say what was said by `hideFrom`; the lit room bakes its own light.
- **Props are boxes where no generator draws the model** (`coat-hook`, `wall-sconce`, `extinguisher-cabinet`,
  `strip-light`, the shelves' stock). Task 13 (dressing) replaces them.
- **Not converted, on purpose:** `all-lamps-die`'s recorded file (nothing in the prologue plays it), act one's hotspots
  and any model, atlas or texture of the old game.
