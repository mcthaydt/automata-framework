// consumer-smoke's web-target step (PUB spec §3): the host imported as the runtime's boot imports it, built with
// the `automata-web` condition as an itch.io or web build is. run.ts then checks the bundle has no Ruken SDK.
import { HOST_EXIT_CAP_MS } from '@mcthaydt/automata'
import { createHosting } from '@mcthaydt/automata/target'

// Kept reachable, so the bundle holds the adapter the condition chose.
Object.assign(globalThis, { boot: createHosting, HOST_EXIT_CAP_MS })
