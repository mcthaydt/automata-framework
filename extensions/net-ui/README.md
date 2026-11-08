# Net UI

What the player sees while playing online: a small badge that says "Connecting…", "Online", "Poor connection" or "Reconnecting…", and a
screen that counts down while the game tries to get back. When the time is up it says it could not reconnect and offers
a Leave button. It works with [`@automata/net`](../net/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

Put the `NetHud` component in the game's overlay slot:

```ts
import { NetHud } from '@automata/net-ui'

export default defineGame({ ui: { slots: { 'hud.overlay': NetHud } } })
```

## What you get

- **`NetBadge`** and **`ReconnectOverlay`**, or both together as **`NetHud`**.
- **Words as locale keys**, so a game can translate them.
- **`createNetStatus`**: the state machine behind them, if you want to draw your own.
