# Net server

The server for an online game. It runs the same simulation as the players, in a room, and decides what is true. It
takes care of the rules around that: who may join, how fast a client may send, what happens when someone drops. Built on
Colyseus. For the browser side, see [`@automata/net`](../net/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

Describe the game once with `defineServer`, then start it:

```ts
import { defineServer, startServer } from '@automata/net-server'

const server = defineServer({ /* seats, the sim, the rules */ })
await startServer(server)
```

`defineServer` checks the description first and refuses one no room could run, for example seats that are not whole
numbers. The `automata-server` command starts the process from the environment's settings.

## What you get

- **A generic room** that runs your sim and adapts its rules.
- **Gates in front of Colyseus**: allowed origins, the game's version, how many requests a client may make and the
  size of a request, so a bad one is refused early.
- **Operations**: probes for the host, a log line for each event, and a drain that moves players on before a deploy
  stops the process, so no game is cut off.
- **`@automata/net-server/testing`**: a room driver and a held clock, for tests only. The server refuses to start with
  a test switch on.
