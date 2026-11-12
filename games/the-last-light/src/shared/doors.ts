/**
 * The doors the walk keeps, by nav door id, and the puzzle fact that opens each: the supply room's door is open once the
 * puzzle's `closetOpen` is true. The level and the walking graph name the door (`closetDoor`); this is the one place the
 * fact joins it.
 */
export const DOOR_FACTS: Readonly<Record<string, string>> = { closetDoor: 'closetOpen' }
