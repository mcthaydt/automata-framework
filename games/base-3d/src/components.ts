// base-3d's Koota traits (DESIGN.md §3.1). Positions are Q16.16 metres and angles turn units (constants.ts); the
// renderer converts them to metres and radians (M3.7b). The camera's view and heading are render-pixi3d's
// `camera-heading`, on the same entity as `hero` (M3 spec §4.2, one owner).
import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const heroFields = {
  x: 'i32',
  z: 'i32',
  /** Where Wick faces, in turn units (0 toward +z, growing toward +x). */
  facing: 'u32',
  /** Whether the stick moved him this tick. */
  moving: 'bool',
  /**
   * His travel relative to his facing, in turn units: 0 forward, ±16,384 a strafe, −32,768 backing away. Angles
   * grow toward +x, so negative is to his right (clockwise seen from above) and positive to his left.
   */
  moveDir: 'i32',
  /** The entity he is locked onto; 0 when none. */
  lockTarget: 'entity',
  /** The ticks running the locked target has been out of his line of sight; at 60 the lock lets go. */
  lockHidden: 'u32',
} as const

/** Wick, the player, as the renderer reads him (the figure's `FigureState`, M3 spec §4.4.5). */
export const Hero: ComponentDef<typeof heroFields> = defineComponent('hero', heroFields)

const controlFields = {
  stickX: 'i32',
  stickY: 'i32',
  lockHeld: 'bool',
  lockPressed: 'bool',
  /** Whether the player's Lock mode is hold (the release lets go) rather than toggle (the next press does). */
  lockHold: 'bool',
  /** This tick's `lock-cycle`: 1 clockwise, −1 anticlockwise, 0 none. */
  lockCycle: 'i32',
  /** The action buttons held this tick and pressed this tick, as `ACTION_BITS` (slash 1, guard 2, point 4, pickup 8). */
  actHeld: 'u32',
  actPressed: 'u32',
} as const

/**
 * This tick's input: the stick (−127..127, y down), whether lock is held, and whether it went down this tick
 * (`lockPressed`, true only on the press, so holding it never locks again), and the action buttons likewise. Not
 * rendered.
 */
export const HeroControl: ComponentDef<typeof controlFields> = defineComponent(
  'hero-control',
  controlFields,
  {
    render: false,
  },
)

const targetFields = {
  x: 'i32',
  z: 'i32',
  /** Where it faces, in turn units as Wick's facing: its reach points this way when it attacks. */
  facing: 'u32',
} as const

/** Something Wick can lock onto, standing at `x`, `z`. */
export const Target: ComponentDef<typeof targetFields> = defineComponent('target', targetFields)

const actionFields = {
  /** The action playing, as `ACTION_CLIP` (0 none, 1 slash, 2 point, 3 pickup). */
  clip: 'u32',
  /** The tick it started on: the figure samples its clip from here. */
  startedAt: 'u32',
  /** Whether the guard stance is held, and the tick it was raised on. */
  guard: 'bool',
  guardSince: 'u32',
} as const

/** Wick's action and stance, as the figure reads them (`FigureState.action` and `stances`, M3 spec §4.4.5). */
export const HeroAction: ComponentDef<typeof actionFields> = defineComponent('hero-action', actionFields)

const fighterFields = {
  /** 0 Wick's side, 1 the foes': a hit lands only on the other side. */
  side: 'u32',
  /** Health in half-hearts. */
  health: 'i32',
  /** `CombatState`. */
  state: 'u32',
  /** The move running, as its index in the world's moves + 1 (0 none), its frame (from 1) and its start tick. */
  move: 'u32',
  moveTick: 'u32',
  moveStart: 'u32',
  /** Ticks left of `stun`, `blockstun`, `stagger` or `down`. */
  stun: 'u32',
  /** Ticks left in which no hit lands. */
  iframes: 'u32',
  /** The move a press queued (index + 1, 0 none), and a press kept through hitstop for the first live tick. */
  queued: 'u32',
  latched: 'bool',
  /** Ticks the attack button has been held running: released at `SPIN_CHARGE` or more, it spins. */
  charge: 'u32',
  /** The last move that hit this fighter: its attacker and start tick, so a move lands once (§7.3 `hitDone`). */
  hitBy: 'entity',
  hitStamp: 'u32',
  /** A push a tick (knockback or a block), Q16.16 metres, for `pushTicks` more ticks. */
  pushX: 'i32',
  pushZ: 'i32',
  pushTicks: 'u32',
  /** The hurt cylinder (§7.3), Q16.16 metres: its radius, its height, and its floor above the ground (a hover). */
  radius: 'i32',
  height: 'i32',
  lift: 'i32',
} as const

/**
 * Anything that fights (DESIGN.md §7): Wick and the training dummies, and GAME-3D.1d's enemies. Its place and
 * facing are its `hero` or `target` row's.
 */
export const Fighter: ComponentDef<typeof fighterFields> = defineComponent('fighter', fighterFields)

const enemyFields = {
  /** Its type, as its index + 1 in `ENEMIES` (constants/enemies.ts). */
  kind: 'u32',
  /** `BrainState`, and the ticks the state has left (notice, recover) or has run (the idle pacing). */
  brain: 'u32',
  timer: 'u32',
  /** Whether it holds one of the attack tokens (§8.1 rule 2): the tokens are these flags, counted. */
  token: 'bool',
  /** The attacks it has started, so it takes its type's `attacks` in turn. */
  attacks: 'u32',
  /** Where it was spawned: an idle enemy paces from here. Q16.16 metres. */
  homeX: 'i32',
  homeZ: 'i32',
  /** The facing its idle pacing walks out along, in turn units. */
  homeFacing: 'u32',
  /** The move its running one chains into when it ends (index + 1, 0 none): a combo's next chop. */
  follow: 'u32',
  /** Ticks until an angry Captain may call again, and the calls it has made (the next vent is `called % vents`). */
  calls: 'u32',
  called: 'u32',
  /** A boss's phase: 0 or 1 the first, 2 the second, never back (DESIGN.md §8.4, G3-F8). */
  phase: 'u32',
} as const

/**
 * An enemy's brain (DESIGN.md §8.1 rule 5): a deterministic state machine on sim state and integer timers. Its place
 * is its `target` row (so it is lockable) and its fighting its `fighter` row.
 */
export const Enemy: ComponentDef<typeof enemyFields> = defineComponent('enemy', enemyFields)

const dropFields = {
  x: 'i32',
  z: 'i32',
  /** `DropKind`: an ember or a recovery heart. */
  kind: 'u32',
  /** How many embers (1 or 5); 1 for a heart. */
  amount: 'u32',
} as const

/** Something a beaten enemy left on the floor (DESIGN.md §8.1 rule 6): Wick takes it by walking over it. */
export const Drop: ComponentDef<typeof dropFields> = defineComponent('drop', dropFields)

const pelletFields = {
  /** Where this tick's flight starts, Q16.16 metres; it reaches one tick's flight along `facing`. */
  x: 'i32',
  z: 'i32',
  /** The height it flies at, Q16.16 metres above the floor: the picked foe's middle, or chest height (DESIGN.md §9.2). */
  y: 'i32',
  /** The aim it flies along, in turn units. */
  facing: 'u32',
  /** How far it has flown, Q16.16 metres; at the sling's range it is gone. */
  travelled: 'i32',
} as const

/**
 * A sling pellet in flight (DESIGN.md §9.1). It is a fighter on Wick's side whose `sling-pellet` move is active on
 * every tick it flies, so `combat.hits` lands it as any hit; it is spent on its first contact.
 */
export const Pellet: ComponentDef<typeof pelletFields> = defineComponent('pellet', pelletFields)

const bombFields = {
  x: 'i32',
  z: 'i32',
  /** Live ticks left before it blasts (DESIGN.md §9.1). */
  fuse: 'u32',
} as const

/**
 * An Ember Bomb on the floor (DESIGN.md §9.1). It is a fighter on neither side, so its blast (`bomb-blast`) reaches
 * Wick and the foes alike.
 */
export const Bomb: ComponentDef<typeof bombFields> = defineComponent('bomb', bombFields)

const chainFields = {
  /** Where this tick's flight starts, Q16.16 metres, and the aim it flies along, in turn units. */
  x: 'i32',
  z: 'i32',
  facing: 'u32',
  /** How far it has flown, Q16.16 metres; at the hookchain's range it returns. */
  travelled: 'i32',
  /** Whether it has hooked a post and pulls Wick to it, and the post's place. */
  pulling: 'bool',
  postX: 'i32',
  postZ: 'i32',
} as const

/** The Hookchain thrown (DESIGN.md §9.1): flying out, or hooked on a post and pulling Wick to it. One at a time. */
export const Chain: ComponentDef<typeof chainFields> = defineComponent('chain', chainFields)

const slingTargetFields = {
  /** Its entity in the area's `entities`, as its index + 1. */
  piece: 'u32',
} as const

/**
 * A sling target (DESIGN.md §10): a lantern, a bell or an eye at a height the area gives it, lockable (a `target` row
 * and a `fighter` on the foes' side), which a pellet hits and nothing harms (GAME-3D.1f part 1).
 */
export const SlingTarget: ComponentDef<typeof slingTargetFields> = defineComponent(
  'sling-target',
  slingTargetFields,
)

const doorFields = {
  /** Its entity in the area's `entities`, as its index + 1. */
  piece: 'u32',
  /** Open, it is nothing; closed, it is a wall to everything (DESIGN.md §10). */
  open: 'bool',
  /** Its box in plan, Q16.16 metres. */
  minX: 'i32',
  minZ: 'i32',
  maxX: 'i32',
  maxZ: 'i32',
} as const

/** A door (DESIGN.md §10, GAME-3D.1f part 2): its lock is its entity's; opened ones are saved by id. */
export const Door: ComponentDef<typeof doorFields> = defineComponent('door', doorFields)

const switchFields = {
  /** Its entity in the area's `entities`, as its index + 1. */
  piece: 'u32',
  on: 'bool',
  /** Its box in plan, Q16.16 metres: a plate's footprint, a lever's or an eye's place. */
  minX: 'i32',
  minZ: 'i32',
  maxX: 'i32',
  maxZ: 'i32',
} as const

/** A switch (DESIGN.md §10, GAME-3D.1f part 3): a plate, an eye or a lever; a latching one stays on and is saved. */
export const Switch: ComponentDef<typeof switchFields> = defineComponent('switch', switchFields)

const blockFields = {
  /** Its entity in the area's `entities`, as its index + 1. */
  piece: 'u32',
  /** Its centre, and where it goes back to on room entry, Q16.16 metres. */
  x: 'i32',
  z: 'i32',
  homeX: 'i32',
  homeZ: 'i32',
  /** Ticks Wick has pushed it running; at `BLOCK_PUSH_TICKS` it moves a cell. */
  push: 'u32',
} as const

/** A pushable block (DESIGN.md §10, GAME-3D.1f part 3): a 1 m cube, a wall to everything but a push. */
export const Block: ComponentDef<typeof blockFields> = defineComponent('block', blockFields)
