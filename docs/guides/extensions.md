# Extensions: add what your game needs

An extension is an extra a game can add: sound, physics, online play and more. The game works without any of them. Add one
only when your game needs it, and your game's own rules stay yours.

## Add one

In your game's folder, add the one you want. This adds the physics extension:

```sh
pnpm add @automataframework/physics
```

Then follow the "Turn it on" part of the extension's own page, which is a few lines in your game's `defineGame`. The
[Reference](/api) lists every name an extension gives you.

## What is there

| Extension | What it does for your game |
|---|---|
| `@automataframework/audio-synth` | Makes sound effects and music from a few numbers, so the game ships no sound files |
| `@automataframework/debug` | A panel you open while you play, to see what the game is doing |
| `@automataframework/feel` | Shake, freeze, flash and squash, so a hit lands |
| `@automataframework/net` | Play together online: join a room and keep the game smooth |
| `@automataframework/net-server` | The server an online game's room runs on |
| `@automataframework/net-ui` | A "Connecting…" badge and a screen that waits while the game reconnects |
| `@automataframework/physics` | Things that fall, bounce and bump, the same in every browser |
| `@automataframework/puzzle` | Locks, keys and goals written as data, with a check that a level can be finished |
| `@automataframework/ui-screens` | Ready-made Title, Results, Loading and Error screens |

## Always the same game

An extension that the game uses runs inside the same checks as the rest: the same start and the same moves give the same
game in every browser. One that is missing says so and stops. It never swaps in a weaker copy behind your back.
