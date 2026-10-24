// Writes `course-goldens.json` and `compose-goldens.json` by running FloorFifty's own code (EDFF.1c, spec FF-D4): the seeded
// course generator (`packages/shared/src/level/{rng,course,demand}.ts`) and `StageLayers.update` with the stage presentation
// (`apps/client/src/systems/render/{stage-layers,stage-presentation}.ts`). The editor's ports are tested against these
// files, so a number in them is what the game computes, not what the port computes.
//
//   node --experimental-transform-types make-goldens.mjs <floorfifty checkout> [<output folder>]
//
// The checkout must be at the commit PROVENANCE.md names. The renderer-only imports of `StageLayers` (textures, haze,
// window codes, the sun shimmer filter) are replaced by stubs in a temporary folder; the layout maths is untouched.
// `pixi.js` is the one the render package resolves, or the folder in `PIXI_DIR`. The files are written compact; run
// `pnpm exec biome check --write` on the folder afterwards, as the repository formats them.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from '@decimalturn/toml-patch'

const [checkoutArgument, outputArgument] = process.argv.slice(2)
if (checkoutArgument === undefined) {
  process.stderr.write(
    'usage: node --experimental-transform-types make-goldens.mjs <floorfifty checkout> [<output folder>]\n',
  )
  process.exit(2)
}
const checkout = resolve(checkoutArgument)
const here = new URL('.', import.meta.url).pathname
const output = resolve(outputArgument ?? here)
const pixiDir = process.env.PIXI_DIR ?? resolve(here, '../../../../../render-pixi/node_modules/pixi.js')

const STAGES = ['dawn', 'rooftops', 'snow-shrine', 'sunken-dome']

// -- the harness: FloorFifty's files, with the renderer-only imports stubbed ----------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'ff-goldens-'))

function write(path, text) {
  mkdirSync(join(work, path, '..'), { recursive: true })
  writeFileSync(join(work, path), text)
}

function copyWithExtensions(from, to) {
  // Node needs the extension FloorFifty's bundler does not.
  const text = readFileSync(join(checkout, from), 'utf8').replace(
    /from "(\.\.?\/[\w/.-]+)";/g,
    'from "$1.ts";',
  )
  write(to, text)
}

copyWithExtensions('packages/shared/src/level/rng.ts', 'level/rng.ts')
copyWithExtensions('packages/shared/src/level/course.ts', 'level/course.ts')
copyWithExtensions('packages/shared/src/level/demand.ts', 'level/demand.ts')
copyWithExtensions('packages/shared/src/common/tuning.ts', 'common/tuning.ts')
copyWithExtensions('packages/shared/src/common/math.ts', 'common/math.ts')
copyWithExtensions('apps/client/src/systems/render/stage-layers.ts', 'systems/render/stage-layers.ts')
copyWithExtensions(
  'apps/client/src/systems/render/stage-presentation.ts',
  'systems/render/stage-presentation.ts',
)

// The client's `LOGICAL_VIEWPORT` is an alias of the shared `VIEWPORT`; one file serves both folders here.
write(
  'common/constants.ts',
  `${readFileSync(join(checkout, 'packages/shared/src/common/constants.ts'), 'utf8')}\nexport const LOGICAL_VIEWPORT = VIEWPORT\n`,
)
write(
  'systems/gameplay/textures.ts',
  "export type TextureProvider = (alias: string) => import('pixi.js').Texture\nexport const loadedTextures = (): never => { throw new Error('stub') }\n",
)
write('systems/render/haze.ts', 'export const hazedTexture = () => undefined\n')
write('systems/render/window-code.ts', 'export const windowCodedTexture = () => undefined\n')
write('systems/render/stage-reactor.ts', 'export type StageMotion = never\n')
write(
  'systems/render/filters/sun-shimmer.ts',
  "export const SUN_SHIMMER_REACH = 1.5\nexport type SunShimmerFilter = never\nexport const createSunShimmerFilter = (): never => { throw new Error('stub') }\nexport const setSunShimmerPadding = () => {}\nexport const setSunShimmerTime = () => {}\n",
)
write(
  'node_modules/@floor-fifty/asset-contract/package.json',
  '{"name":"@floor-fifty/asset-contract","type":"module","exports":{"./roles":"./roles.js"}}\n',
)
write('node_modules/@floor-fifty/asset-contract/roles.js', 'export const roleTint = () => 0\n')
symlinkSync(pixiDir, join(work, 'node_modules/pixi.js'))
write('pixi.mjs', "export * from 'pixi.js'\n")

const href = (path) => pathToFileURL(join(work, path)).href
const { createCourse } = await import(href('level/course.ts'))
const { stepDemands, bounceBudget } = await import(href('level/demand.ts'))
const { createRng, deriveSeed } = await import(href('level/rng.ts'))
const { resolveTuning } = await import(href('common/tuning.ts'))
const { StageLayers } = await import(href('systems/render/stage-layers.ts'))
const { resolveStagePresentation } = await import(href('systems/render/stage-presentation.ts'))
const { RenderTexture, TilingSprite } = await import(href('pixi.mjs'))

const stages = Object.fromEntries(
  STAGES.map((id) => [id, parse(readFileSync(join(here, 'stages', `${id}.toml`), 'utf8'))]),
)

// -- the course -----------------------------------------------------------------------------------------------------------

const courseCases = [
  { name: 'rooftops', seed: stages.rooftops.course.seed, tuning: {} },
  { name: 'snow-shrine', seed: stages['snow-shrine'].course.seed, tuning: {} },
  { name: 'sunken-dome', seed: stages['sunken-dome'].course.seed, tuning: {} },
  { name: 'a hundred floors across every ramp band', seed: 35229, tuning: { COURSE_FLOOR_COUNT: 100 } },
  {
    name: 'a steep ramp',
    seed: 35229,
    tuning: {
      COURSE_FLOOR_COUNT: 80,
      DEMAND_RAMP_BAND_FLOORS: 3,
      MOVING_SHARE_STEP: 0.2,
      MOVING_SHARE_MAX: 0.6,
      MOVING_SPEED_STEP: 40,
      MOVING_FLOOR_SPEED_CAP: 250,
    },
  },
  {
    name: 'wide floors, a taller gap, other physics',
    seed: 7,
    tuning: {
      COURSE_FLOOR_COUNT: 30,
      FLOOR_WIDTH: 200,
      FLOOR_GAP_MIN: 100,
      DEATH_LINE_MARGIN: 300,
      GRAVITY: -300,
      BOUNCE_VELOCITY: 300,
      MAX_MOVE_SPEED: 400,
      PLAYER_WIDTH: 40,
      MOVING_FLOOR_SPEED_MIN: 20,
      MOVING_FLOOR_SPEED_MAX: 90,
    },
  },
  { name: 'seed 0', seed: 0, tuning: {} },
  { name: 'the largest 32-bit seed', seed: 4294967295, tuning: {} },
  { name: 'a seed past 32 bits', seed: 4294967296 + 12345, tuning: {} },
]

const courses = courseCases.map((entry) => {
  const tuning = resolveTuning(entry.tuning)
  const course = createCourse(entry.seed, tuning)
  return {
    ...entry,
    budget: bounceBudget(tuning),
    floorCount: course.floorCount,
    bounds: course.bounds,
    deathLineY: course.deathLineY,
    // [index, x, y, kind, speed, direction]
    floors: course.floors.map((f) => [f.index, f.x, f.y, f.kind, f.speed, f.direction]),
    demands: stepDemands(course, tuning),
  }
})

const derived = [
  [0, 0],
  [1, 1],
  [35229, 3],
  [4294967295, 19],
  [4294967296 + 5, 0],
  [-1, 2],
].map(([seed, salt]) => {
  const result = deriveSeed(seed, salt)
  const rng = createRng(result)
  return {
    seed,
    salt,
    derived: result,
    uint32: [rng.nextUint32(), rng.nextUint32(), rng.nextUint32()],
    float: rng.nextFloat(),
    int: rng.nextInt(-3, 3),
    range: rng.nextRange(10, 20),
  }
})

const streams = [0, 1, 123456789, 4294967295, -7].map((seed) => {
  const rng = createRng(seed)
  return { seed, uint32: [rng.nextUint32(), rng.nextUint32(), rng.nextUint32(), rng.nextUint32()] }
})

// -- the composition ------------------------------------------------------------------------------------------------------

const aliases = [
  ...new Set(STAGES.flatMap((id) => stages[id].theme.layers.map((layer) => layer.alias))),
].sort()
// A strip's height is the art's. A plate is a whole frame; the others differ, so the framing has something to measure.
const heights = {}
aliases.forEach((alias, index) => {
  heights[alias] = 140 + 30 * (index % 10)
})
for (const id of STAGES)
  for (const layer of stages[id].theme.layers) if (layer.extend === 'plate') heights[layer.alias] = 540

const states = [
  { cameraY: 0, progress: 0, timeSeconds: 0 },
  { cameraY: 640, progress: 0.25, timeSeconds: 12.5 },
  { cameraY: 2570, progress: 0.5, timeSeconds: 0 },
  { cameraY: 5000, progress: 0.8, timeSeconds: 31.25 },
  { cameraY: 9000, progress: 1, timeSeconds: 7 },
]
const framings = [{}, { cityTopMin: 380 }, { pixelsPerUnit: 2.5, cityTopMin: 380 }, { pixelsPerUnit: 1.7 }]

const textures = new Map()
function provider(alias) {
  let texture = textures.get(alias)
  if (texture === undefined) {
    texture = RenderTexture.create({ width: 960, height: heights[alias] })
    textures.set(alias, texture)
  }
  return texture
}

const composed = {}
for (const id of STAGES) {
  const presentation = resolveStagePresentation(stages[id])
  const first = new StageLayers(presentation, provider)
  const frames = []
  for (let s = 0; s < states.length; s++) {
    for (let f = 0; f < framings.length; f++) {
      const layers = new StageLayers(presentation, provider)
      const state = states[s]
      // Reduced motion applies the lift and the city's sink at once, which is where the eased values come to rest.
      layers.update(state.cameraY, state.progress, state.timeSeconds, 16, true, framings[f])
      const placed = new Map(
        [...layers.skyRoot.children, ...layers.cityRoot.children].map((child) => [child.label, child]),
      )
      const sun = presentation.lightAlias === undefined ? undefined : placed.get(presentation.lightAlias)
      frames.push({
        state: s,
        framing: f,
        lift: layers.horizonLift,
        citySink: layers.citySink,
        sunY: sun === undefined ? null : sun.position.y,
        // [alias, y, tileX or null for an untiled sky plate]
        layers: layers.labels.map((label) => {
          const child = placed.get(label)
          return [label, child.position.y, child instanceof TilingSprite ? child.tilePosition.x : null]
        }),
      })
      layers.destroy()
    }
  }
  composed[id] = { labels: first.labels, factors: first.factors, frames }
  first.destroy()
}

mkdirSync(output, { recursive: true })
const source = 'FloorFifty ee5d44e, run by testing/make-goldens.mjs'
writeFileSync(
  join(output, 'course-goldens.json'),
  `${JSON.stringify({ source, cases: courses, derived, streams })}\n`,
)
writeFileSync(
  join(output, 'compose-goldens.json'),
  `${JSON.stringify({ source, heights, states, framings, stages: composed })}\n`,
)
rmSync(work, { recursive: true, force: true })
process.stdout.write(
  `wrote ${courses.length} course cases and ${STAGES.length} stages x ${states.length * framings.length} frames\n`,
)
