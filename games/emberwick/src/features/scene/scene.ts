import type { FieldRecord, StepResult } from '@automata/sim'
import {
  Container,
  Graphics,
  type Renderer as PixiRenderer,
  RenderTexture,
  Sprite,
  type Texture,
} from 'pixi.js'
import { duel } from '../../shared/art/palette.ts'
import {
  EDGE_BOTTOM,
  EDGE_LEFT,
  EDGE_RIGHT,
  EMBER,
  GRASS,
  MOSS_TOP,
  MUSHROOM,
  STONE_A,
  STONE_B,
  STONE_C,
  VINE,
  VINE_END,
  WICK_FALL,
  WICK_IDLE_A,
  WICK_IDLE_B,
  WICK_JUMP,
  WICK_RUN_A,
  WICK_RUN_B,
} from '../../shared/art/sprites.ts'
import { lightTexture, textureFromPixels, vignetteTexture } from '../../shared/pixels.ts'
import type { Room } from '../../shared/room.ts'
import { HITBOX_H, HITBOX_W, SUB } from '../../shared/tuning.ts'
import { createBackdrop } from './backdrop.ts'
import { Particles } from './particles.ts'
import { planTiles } from './tiles.ts'

// Emberwick's scene: the room, Wick, the light map and the effects, drawn into containers a Pixi renderer
// shows. `startGame` shows it on render-pixi's stage (scene-renderer.ts); the demos' `createRenderer`
// (renderer.ts) shows it on its own Pixi application. It reads the sim's RenderDelta and events and never
// writes the sim.
//
// Lighting, as many current pixel-art games do it: the room is drawn, then a light map multiplies over it. The
// light map is a render texture cleared to a dim moonlight each frame, with the lantern, the ember, the
// mushrooms and the fireflies added into it as stepped, dithered pixel lights. Things that give off light
// (Wick, the ember, sparks) are drawn above the light map so they stay bright, with additive halos for bloom.

interface PlayerView {
  x: number
  y: number
  vx: number
  vy: number
  facing: number
  grounded: boolean
}

/**
 * An extra drawing layer for a demo built on the base (crates and balls for the physics demo, say). It is drawn
 * above the room's tiles and plants and below the light map, so the lantern and the ember light it like the
 * room, and below Wick. It hears every sim step, display frame and round reset, as the renderer itself does.
 */
export interface RendererLayer {
  readonly view: Container
  apply?(result: StepResult): void
  draw?(time: number): void
  reset?(): void
}

export interface Scene {
  /** Everything that shakes as one: put it on the stage. */
  readonly world: Container
  /** The vignette and the flash, over the world and still while it shakes. */
  readonly overlay: Container
  /** Takes one sim step's render changes and events. */
  apply(result: StepResult): void
  /** One display frame. `time` is in milliseconds. */
  draw(time: number): void
  /** Forgets the old sim's entities (a new round starts with a fresh sim and a resync). */
  reset(): void
  /** The character's hitbox top-left in pixels, for the page's data attributes. */
  playerPixel(): { x: number; y: number } | null
  /**
   * Adds a demo's layer (see RendererLayer); the returned function removes it again, and is safe to call after
   * destroy. The layer's view, and the textures its sprites use, are destroyed with the renderer.
   */
  addLayer(layer: RendererLayer): () => void
  /** True if `view` is drawn under the light map, so the room's lights fall on it (a demo can check its layer). */
  isLitByRoom(view: Container): boolean
  destroy(): void
}

const AMBIENT = duel(83) // #73737f: moonlight, what the light map holds where no light reaches
const LANTERN_RADIUS = 52
const EMBER_RADIUS = 60
// Where the lantern hangs relative to Wick's feet (bottom centre of the sprite), facing right.
const LANTERN_DX = 6
const LANTERN_DY = -4

// Fireflies drift around fixed homes (pixels) on slow sine paths, so their motion needs no randomness.
const FIREFLY_HOMES: ReadonlyArray<readonly [x: number, y: number]> = [
  [40, 150],
  [96, 120],
  [150, 160],
  [210, 110],
  [270, 140],
  [300, 60],
  [60, 60],
  [180, 40],
  [230, 170],
  [120, 80],
]

/** Builds the scene for `room`. `renderer` renders the light map into its texture before each frame. */
export function createScene(renderer: PixiRenderer, room: Room): Scene {
  const width = room.width * room.tileSize
  const height = room.height * room.tileSize
  const size = room.tileSize
  const frames = {
    idleA: textureFromPixels(WICK_IDLE_A),
    idleB: textureFromPixels(WICK_IDLE_B),
    runA: textureFromPixels(WICK_RUN_A),
    runB: textureFromPixels(WICK_RUN_B),
    jump: textureFromPixels(WICK_JUMP),
    fall: textureFromPixels(WICK_FALL),
  }

  // The world shakes as one; the vignette and the flash stay put over it.
  const world = new Container()
  const overlay = new Container()
  const backdrop = createBackdrop(width, height)
  world.addChild(backdrop.view)

  const plan = planTiles(room)
  const vineLayer = new Container()
  const vineTextures = { mid: textureFromPixels(VINE), end: textureFromPixels(VINE_END) }
  const vines = plan.vines.map(({ tx, ty, end }) => {
    const vine = place(vineLayer, end ? vineTextures.end : vineTextures.mid, tx * size, ty * size)
    return { vine, home: tx * size, phase: tx * 0.7 }
  })
  world.addChild(vineLayer)

  const tileLayer = new Container()
  const stones = [textureFromPixels(STONE_A), textureFromPixels(STONE_B), textureFromPixels(STONE_C)]
  for (const { tx, ty, variant } of plan.stone)
    place(tileLayer, stones[variant] as Texture, tx * size, ty * size)
  const overlays = {
    mossTop: textureFromPixels(MOSS_TOP),
    edgeLeft: textureFromPixels(EDGE_LEFT),
    edgeRight: textureFromPixels(EDGE_RIGHT),
    edgeBottom: textureFromPixels(EDGE_BOTTOM),
  }
  // Edges first, then moss, so the moss drapes over the corners.
  for (const { tx, ty, piece } of [...plan.overlays].sort((a, b) => order(a.piece) - order(b.piece)))
    place(tileLayer, overlays[piece], tx * size, ty * size)
  world.addChild(tileLayer)

  const growthLayer = new Container()
  const grassTexture = textureFromPixels(GRASS)
  for (const { tx, ty } of plan.grass) place(growthLayer, grassTexture, tx * size, ty * size + size - 4)
  const mushroomTexture = textureFromPixels(MUSHROOM)
  for (const { tx, ty } of plan.mushrooms)
    place(growthLayer, mushroomTexture, tx * size, ty * size + size - 6)
  world.addChild(growthLayer)
  // Demo layers go here: over the room, under the light map (addLayer).
  const demoLayers = new Container()
  world.addChild(demoLayers)
  const layers: RendererLayer[] = []

  // The light map.
  const lightStage = new Container()
  const ambient = new Graphics().rect(0, 0, width, height).fill(AMBIENT)
  lightStage.addChild(ambient)
  const shafts = new Graphics()
  for (const [x, w] of [
    [70, 18],
    [150, 10],
    [205, 22],
  ] as const)
    shafts.poly([x, 0, x + w, 0, x + w + 70, height, x + 70, height]).fill({ color: duel(63), alpha: 0.1 })
  shafts.blendMode = 'add'
  lightStage.addChild(shafts)
  const moonLight = addLight(lightStage, 70, duel(63), 262, 34)
  moonLight.alpha = 0.35
  for (const { tx, ty } of plan.mushrooms) addLight(lightStage, 14, duel(62), tx * size + 4, ty * size + 5)
  const emberX = room.goal.tx * size + size / 2
  const emberY = room.goal.ty * size + size / 2
  const emberLight = addLight(lightStage, EMBER_RADIUS, duel(252), emberX, emberY)
  const lanternLight = addLight(lightStage, LANTERN_RADIUS, duel(253), 0, 0)
  const fireflyLights = FIREFLY_HOMES.map(([x, y]) => addLight(lightStage, 7, duel(223), x, y))
  const lightMap = RenderTexture.create({ width, height, resolution: 1 })
  const lightOverlay = new Sprite(lightMap)
  lightOverlay.blendMode = 'multiply'
  world.addChild(lightOverlay)

  // Bloom-like halos, added over the light map.
  const glowLayer = new Container()
  const emberHalo = addLight(glowLayer, 18, duel(75), emberX, emberY)
  emberHalo.alpha = 0.4
  const lanternHalo = addLight(glowLayer, 22, duel(252), 0, 0)
  lanternHalo.alpha = 0.3
  for (const { tx, ty } of plan.mushrooms)
    addLight(glowLayer, 5, duel(63), tx * size + 4, ty * size + 3).alpha = 0.5
  const fireflies = FIREFLY_HOMES.map(([x, y]) => {
    const glow = addLight(glowLayer, 2, duel(223), x, y)
    return glow
  })
  world.addChild(glowLayer)
  world.addChild(backdrop.moon)

  const ember = new Sprite(textureFromPixels(EMBER))
  ember.anchor.set(0.5)
  ember.position.set(emberX, emberY)
  world.addChild(ember)
  const orbit = [0, 1, 2].map(() => {
    const spark = addLight(world, 1, duel(39), emberX, emberY)
    spark.blendMode = 'add'
    return spark
  })

  const trailLayer = new Container()
  world.addChild(trailLayer)
  const particleLayer = new Container()
  world.addChild(particleLayer)
  const particles = new Particles(particleLayer)

  const character = new Sprite(frames.idleA)
  character.anchor.set(0.5, 1) // bottom centre, on the hitbox's feet
  character.visible = false
  world.addChild(character)

  const vignette = new Sprite(vignetteTexture(width, height, duel(224), 0.7))
  overlay.addChild(vignette)
  const flash = new Graphics().rect(0, 0, width, height).fill(duel(247))
  flash.alpha = 0
  overlay.addChild(flash)

  let player: PlayerView | null = null
  let goalReached = false
  let stepCount = 0
  let airborneSteps = 0
  // Squash and stretch: the sprite's scale eases back to 1 each frame after a jump or landing.
  let squashX = 1
  let squashY = 1
  let shake = 0
  const trail: Array<{ sprite: Sprite; life: number }> = []

  return {
    world,
    overlay,
    apply(result) {
      for (const layer of layers) layer.apply?.(result)
      stepCount++
      const delta = result.render
      if (delta.resync) player = null
      for (const row of [...delta.added, ...delta.changed]) {
        const fields = row.components.player
        if (fields !== undefined) player = toPlayerView(fields)
      }
      for (const event of result.events) {
        const at = event.payload as { x: number; y: number }
        const feetX = at.x + HITBOX_W / 2
        const feetY = at.y + HITBOX_H
        if (event.type === 'player.jumped') {
          squashX = 0.7
          squashY = 1.35
          particles.dust(feetX, feetY, 4)
        } else if (event.type === 'player.landed') {
          // A long fall lands harder: more dust, a deeper squash and a one-pixel shake.
          const hard = airborneSteps > 28
          squashX = hard ? 1.45 : 1.3
          squashY = hard ? 0.6 : 0.75
          particles.dust(feetX, feetY, hard ? 8 : 5)
          if (hard) shake = 8
        } else if (event.type === 'goal.reached') {
          goalReached = true
          particles.sparks(emberX, emberY, 28)
          flash.alpha = 0.55
        }
      }
      if (player === null) return
      airborneSteps = player.grounded ? 0 : airborneSteps + 1
      const feetX = Math.floor(player.x / SUB) + HITBOX_W / 2
      const feetY = Math.floor(player.y / SUB) + HITBOX_H
      // A puff behind the feet every few steps while running.
      if (player.grounded && player.vx !== 0 && stepCount % 9 === 0)
        particles.dust(feetX - player.facing * 3, feetY, 1)
      // An afterimage every few steps while rising.
      if (!player.grounded && player.vy < 0 && stepCount % 3 === 0) {
        const ghost = new Sprite(character.texture)
        ghost.anchor.set(0.5, 1)
        ghost.position.set(feetX, feetY)
        ghost.scale.set(player.facing, 1)
        ghost.tint = duel(62)
        ghost.alpha = 0.4
        trailLayer.addChild(ghost)
        trail.push({ sprite: ghost, life: 10 })
      }
    },
    draw(time) {
      squashX += (1 - squashX) * 0.25
      squashY += (1 - squashY) * 0.25
      particles.update()
      for (let i = trail.length - 1; i >= 0; i--) {
        const ghost = trail[i] as { sprite: Sprite; life: number }
        ghost.life -= 1
        ghost.sprite.alpha = (ghost.life / 10) * 0.4
        if (ghost.life <= 0) {
          ghost.sprite.destroy()
          trail.splice(i, 1)
        }
      }
      if (shake > 0) shake -= 1
      world.position.set(shake > 0 ? (shake % 2 === 0 ? 1 : -1) : 0, shake > 0 ? (shake % 4 < 2 ? 1 : 0) : 0)
      flash.alpha *= 0.88

      // Wick, and the lantern light that follows.
      const playerX = player === null ? width / 2 : Math.floor(player.x / SUB) + HITBOX_W / 2
      backdrop.update(playerX, time)
      if (player === null) {
        character.visible = false
        lanternLight.visible = false
        lanternHalo.visible = false
      } else {
        const feetY = Math.floor(player.y / SUB) + HITBOX_H
        character.visible = true
        character.texture = pickFrame(player, stepCount, frames)
        character.position.set(playerX, feetY)
        character.scale.set(squashX * player.facing, squashY)
        // The flame flickers: two slow sines that never quite repeat.
        const flicker = 0.88 + 0.08 * Math.sin(time / 90) + 0.04 * Math.sin(time / 37)
        const lanternX = playerX + LANTERN_DX * player.facing
        const lanternY = feetY + LANTERN_DY
        for (const light of [lanternLight, lanternHalo]) {
          light.visible = true
          light.position.set(lanternX, lanternY)
        }
        lanternLight.alpha = flicker
        lanternHalo.alpha = 0.3 * flicker
      }

      // The ember bobs, pulses and is circled by three sparks until it is reached.
      const pulse = 0.85 + 0.15 * Math.sin(time / 260)
      ember.visible = !goalReached
      ember.y = emberY + Math.round(Math.sin(time / 420) * 2)
      emberLight.alpha = goalReached ? emberLight.alpha * 0.97 : pulse
      emberHalo.alpha = goalReached ? 0 : 0.4 * pulse
      orbit.forEach((spark, i) => {
        const angle = time / 500 + (i * Math.PI * 2) / 3
        spark.visible = !goalReached
        spark.position.set(
          Math.round(emberX + Math.cos(angle) * 10),
          Math.round(ember.y + Math.sin(angle) * 6),
        )
      })

      FIREFLY_HOMES.forEach(([x, y], i) => {
        const fx = Math.round(x + Math.sin(time / (1700 + i * 130) + i) * 14)
        const fy = Math.round(y + Math.cos(time / (1300 + i * 170) + i * 2) * 9)
        const blink = Math.max(0, Math.sin(time / (600 + i * 50) + i))
        const glow = fireflies[i] as Sprite
        const light = fireflyLights[i] as Sprite
        glow.position.set(fx, fy)
        light.position.set(fx, fy)
        glow.alpha = blink
        light.alpha = blink * 0.8
      })
      for (const { vine, home, phase } of vines)
        vine.x = home + Math.round(Math.sin(time / 900 + phase) * 0.6)

      for (const layer of layers) layer.draw?.(time)
      renderer.render({ container: lightStage, target: lightMap, clear: true })
    },
    reset() {
      player = null
      goalReached = false
      airborneSteps = 0
      squashX = 1
      squashY = 1
      shake = 0
      flash.alpha = 0
      emberLight.alpha = 1
      particles.clear()
      for (const ghost of trail) ghost.sprite.destroy()
      trail.length = 0
      for (const layer of layers) layer.reset?.()
    },
    playerPixel() {
      return player === null ? null : { x: Math.floor(player.x / SUB), y: Math.floor(player.y / SUB) }
    },
    addLayer(layer) {
      demoLayers.addChild(layer.view)
      layers.push(layer)
      return () => {
        const at = layers.indexOf(layer)
        if (at < 0) return // already removed, or the renderer was destroyed with everything in it
        layers.splice(at, 1)
        demoLayers.removeChild(layer.view)
      }
    },
    isLitByRoom(view) {
      for (let node: Container | null = view; node !== null; node = node.parent)
        if (node.parent === world) return world.getChildIndex(node) < world.getChildIndex(lightOverlay)
      return false
    },
    destroy() {
      // Forget the layers first: a step or frame that arrives late, or a demo's remove, must not reach them.
      layers.length = 0
      // The light map is the scene's own; `world` and `overlay` go with the stage they were put on.
      lightMap.destroy(true)
      lightStage.destroy({ children: true })
    },
  }
}

function place(layer: Container, texture: Texture, x: number, y: number): Sprite {
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  layer.addChild(sprite)
  return sprite
}

/** A pixel light centred on (x, y), tinted and added into `layer`. */
function addLight(layer: Container, radius: number, color: string, x: number, y: number): Sprite {
  const light = new Sprite(lightTexture(radius))
  light.anchor.set(0.5)
  light.position.set(x, y)
  light.tint = color
  light.blendMode = 'add'
  layer.addChild(light)
  return light
}

function order(piece: string): number {
  return piece === 'mossTop' ? 1 : 0
}

function toPlayerView(fields: Readonly<FieldRecord>): PlayerView {
  return {
    x: Number(fields.x),
    y: Number(fields.y),
    vx: Number(fields.vx),
    vy: Number(fields.vy),
    facing: Number(fields.facing) < 0 ? -1 : 1,
    grounded: fields.grounded === true,
  }
}

/** Breathing idle (a new frame every 40 steps), a two-frame run (every 6 steps), or jump or fall by speed. */
function pickFrame<T>(
  player: PlayerView,
  step: number,
  frames: { idleA: T; idleB: T; runA: T; runB: T; jump: T; fall: T },
): T {
  if (!player.grounded) return player.vy < 0 ? frames.jump : frames.fall
  if (player.vx === 0) return Math.floor(step / 40) % 2 === 0 ? frames.idleA : frames.idleB
  return Math.floor(step / 6) % 2 === 0 ? frames.runA : frames.runB
}
