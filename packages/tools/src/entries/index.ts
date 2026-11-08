// @mcthaydt/automata-tools: the one thing a game imports from the build tools, the type of its `ship.config.ts`. The
// commands are the `automata` bin; what the repository's own tooling imports is in `./internal` (not published).
export type { ItchConfig, ItchSettings } from '../shared/ship/config/itch-config.schema.ts'
export { defineShipConfig, type ShipConfig } from '../shared/ship/config/ship-config.ts'
export type { TauriConfig } from '../shared/ship/config/tauri-config.schema.ts'
