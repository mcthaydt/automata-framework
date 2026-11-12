# Net

Play together online. This is the part that runs in the player's browser: it joins a room, keeps the connection alive,
predicts the player's own moves so the game feels instant, and smooths what the other players do. The room itself runs
on [`@automataframework/net-server`](../net-server/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

The simulation side is a plugin. Add it to the game's sim, then open a room:

```ts
import { createNetRoom } from '@automataframework/net'
import { netPlugin } from '@automataframework/net/sim'

export default defineGame({ sim: { plugins: [netPlugin] } })
```

`createNetRoom` joins a room and tells you the state of the connection. Add [`@automataframework/net-ui`](../net-ui/README.md)
for the badge and the "reconnecting" screen.

## Tell a player their tab is out of date

A player whose tab was open before you deployed has an old build, and the server will refuse it at the join. Say so
before the title instead. The server serves its build facts on `GET /version`; `@automataframework/net-ui` has the opening step
that asks for them, three lines in your game:

```ts
import { PROTOCOL_VERSION } from '@automataframework/net'
import { staleBuildStep } from '@automataframework/net-ui'

defineGame({
  // …
  opening: [
    staleBuildStep({
      facts: { protocol: PROTOCOL_VERSION, schemaHash, contentHash }, // what the game already joins with
      fetchFacts: () => fetch(`${serverUrl}/version`).then((response) => response.json()),
    }),
  ],
})
```

A current or slow answer (1.5 seconds) lets the title through; a stale one shows "This game was updated" with a Reload
button and stays. An answer the check cannot read (the server is down, or answers something else) also lets the title
through, so a probe that fails never locks anyone out, but it is logged to the console as "Could not check whether this
tab is up to date" and is never counted as a pass (`checkServerVersion` answers a `VersionVerdict`: `current`, `stale` or `unchecked`, never `current` for an answer it could not read). The join check is
still the authority.

The server is another origin than your game, so `GET /version` carries the CORS header for the origins in
`allowedOrigins`. A game served from an origin that is not listed gets the console line above, not a stale panel.

## What you get

- **Rooms and seats**: join, leave, and come back after a drop to the seat that was yours.
- **Prediction and reconciliation** (`createNetSession`): your move happens now and is corrected if the server
  disagrees.
- **Interpolation**, so the other players move smoothly.
- **`@automataframework/net/testing`**: a fake connection and a fake server for tests, so no test needs a network.
