# Net

Play together online. This is the part that runs in the player's browser: it joins a room, keeps the connection alive,
predicts the player's own moves so the game feels instant, and smooths what the other players do. The room itself runs
on [`@automata/net-server`](../net-server/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

The simulation side is a plugin. Add it to the game's sim, then open a room:

```ts
import { createNetRoom } from '@automata/net'
import { netPlugin } from '@automata/net/sim'

export default defineGame({ sim: { plugins: [netPlugin] } })
```

`createNetRoom` joins a room and tells you the state of the connection. Add [`@automata/net-ui`](../net-ui/README.md)
for the badge and the "reconnecting" screen.

## What you get

- **Rooms and seats**: join, leave, and come back after a drop to the seat that was yours.
- **Prediction and reconciliation** (`createNetSession`): your move happens now and is corrected if the server
  disagrees.
- **Interpolation**, so the other players move smoothly.
- **`@automata/net/testing`**: a fake connection and a fake server for tests, so no test needs a network.
