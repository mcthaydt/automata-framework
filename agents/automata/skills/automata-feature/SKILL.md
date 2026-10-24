---
name: automata-feature
description: Test-first flow for a gameplay change in an Automata game (command, system, golden test, then view), with a worked double-jump example. Use when adding or changing gameplay.
---

# Adding gameplay, test first

Every gameplay change goes through the sim, in four steps: the **command** (what the player does), the **system**
(the rule), the **golden test** (proof, in ticks and a hash), then the **view** (how it looks). Write the test before
the rule, run it, and watch it fail for the reason you expect.

The worked example below is a double jump on a flat floor. Its files are real: they are typechecked, tested and
boundary-checked in the framework's CI against this version's packages.

| Step | File | What it shows |
|---|---|---|
| State | [example/src/sim/body.component.ts](example/src/sim/body.component.ts) | Integer fields; tuning constants beside them |
| Command | [example/src/sim/jump.command.ts](example/src/sim/jump.command.ts) | A Zod payload; the only way a player changes the sim |
| Rule | [example/src/sim/double-jump.system.ts](example/src/sim/double-jump.system.ts) | Read commands and components, write components; no clock, no randomness |
| Register | [example/src/sim/double-jump.plugin.ts](example/src/sim/double-jump.plugin.ts) | One plugin lists every definition |
| Golden test | [example/src/sim/double-jump.test.ts](example/src/sim/double-jump.test.ts) | Drive with commands, read components, pin a hash |

## 1. Command and state

- Name the input the player gives as a command: `defineCommand('jump', z.object({}))` in `jump.command.ts`. Its
  payload is a Zod schema; a command that fails it is rejected, not run.
- Put the state the rule needs in a component (`defineComponent('body', { y: 'i32', vy: 'i32', airJumps: 'u32' })`).
  Fields are typed (`i32`, `u32`, `f32`, `bool`, …). Use integers for positions and speeds.
- If the change only needs existing state, skip this and change the system.

## 2. The golden test, before the rule

In `src/sim/<feature>.test.ts`:

1. Create the sim with a fixed seed and your plugin (`createSim({ seed: 1, plugins: [...] })`) and spawn what the test
   needs. Dispose every sim after its test.
2. Drive it only with commands, one `sim.step([...])` per tick, as the input map would. Assert `rejected` is empty.
3. Assert behavior from components: the double jump's tests check a jump from the floor, one more in the air, a
   third press ignored, and the air jump restored on landing.
4. Pin a scripted run to `sim.hash()`. Record the hash the first time the behavior is right. Later, a different hash
   means the behavior changed: find out why, and never paste the new hash in to make it pass.

Run it (`vitest run src/sim/<feature>.test.ts`) and confirm it fails because the rule does not exist yet.

## 3. The rule

Write the system in `<feature>.system.ts` with `defineSystem({ name, phase, run(ctx) { … } })`:

- `ctx.commands.of(Jump)` gives this tick's commands; `ctx.query(Body)` the entities; `entity.get` / `entity.set`
  read and write components; `ctx.emit` sends an event the renderer can react to.
- Pick the phase for the rule's order in the tick (`input`, `physics`, `postPhysics`, …).
- Add it to the plugin. Then run the test until it passes, then `automata check --sim-only --json`.

## 4. The view

The renderer reads each step's render delta (components not declared `render: false`) and events, and draws them,
interpolating between ticks. Add or change the view in `src/render/` only after the test passes, and keep every
gameplay decision in the sim: the view never changes state.

## Done when

- The focused test passes, and so does `automata check --json`.
- No existing golden hash changed, or you can say exactly which behavior changed it and why that was intended.
