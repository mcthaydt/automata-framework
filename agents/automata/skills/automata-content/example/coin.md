# The coin

A coin a person places in Levels and picks up in play. It touches every row that a first feature needs. This is written
for a game made with the story (`create-game` with the story packages); a plain game has no `story-sim.ts` and spawns in
`src/app/game.ts` instead.

## 1. The definition and the placed coins (content)

In Characters, add a character `coin` (a picture or a flat colour, size 8 × 8). In Levels, place it. Both are files an
editor writes:

- `content/project.toml` gains the `coin` definition.
- `content/levels/start.af2d.json` gains items on the `entities` layer whose `def` is `coin`.

You can add them by hand for a test, but the person does it in the editors.

## 2. The sim feature (code)

`src/features/coin/coin.component.ts`:

```ts
import { defineComponent } from '@automata/sim'

/** A coin lying where the person placed it: its centre, in the level's pixels. */
export const Coin = defineComponent('coin', { x: 'f32', y: 'f32' })
```

`src/features/coin/coin-collected.event.ts` (Feel and Audio answer it):

```ts
import { defineEvent } from '@automata/sim'
import { z } from 'zod'

/** The player picked up a coin. */
export const CoinCollected = defineEvent('coin.collected', z.object({}))
```

`src/features/coin/pick-up.system.ts`:

```ts
import { defineSystem } from '@automata/sim'
import { Square } from '../square/square.component.ts'
import { CoinCollected } from './coin-collected.event.ts'
import { Coin } from './coin.component.ts'

const HALF = 4

/** A coin is picked up when the player's square touches it. Only the sim changes the game. */
export const pickUp = defineSystem('pick-up', (ctx) => {
  for (const player of ctx.query(Square)) {
    const at = player.get(Square)
    for (const coin of ctx.query(Coin)) {
      const c = coin.get(Coin)
      if (Math.abs(c.x - at.x) < HALF * 2 && Math.abs(c.y - at.y) < HALF * 2) {
        ctx.emit(CoinCollected, {})
        ctx.despawn(coin.sid)
      }
    }
  }
})
```

`src/features/coin/coin.plugin.ts`:

```ts
import { definePlugin } from '@automata/sim'
import { CoinCollected } from './coin-collected.event.ts'
import { Coin } from './coin.component.ts'
import { pickUp } from './pick-up.system.ts'

export const coinPlugin = definePlugin({ name: 'coin', defs: [Coin, CoinCollected, pickUp] })
```

## 3. One entity per placed coin (setup)

`src/features/coin/coin-items.ts` reads the level file, not made-up numbers:

```ts
import { entitiesOf } from '@automata/content/level-2d'
import { startLevel } from '../level/level-content.ts'

/** Every coin the person placed, at its pivot (the feet). */
export const placedCoins = () =>
  entitiesOf(startLevel, 'entities')
    .filter((item) => item.def === 'coin')
    .map((item) => ({ x: item.x, y: item.y }))
```

In `src/app/story-sim.ts`, spawn them in `setup`, and add the plugin (the step an agent forgets):

```ts
export const PLUGINS = [squarePlugin, storyPlugin, coinPlugin]

export function setup(sim: Sim): void {
  // …the player, as before
  for (const coin of placedCoins()) sim.spawn([[Coin, coin]])
}
```

## 4. Drawing it once (the other step an agent forgets)

Core draws every placed character unless its definition is in `live`. The coin is spawned by code, so say so, and
register its view:

```ts
// src/features/level/level-scene.ts
live: ['player-start', 'guard', 'coin', 'area']

// src/features/coin/coin.view.ts
import { pictureView } from '@automata/framework'
import { images, project } from '../level/level-scene.ts'
import { Coin } from './coin.component.ts'

export const coinView = { [Coin.id]: pictureView(project, 'coin', images) }

// src/app/game.ts: views: { ...squareView, ...coinView }
```

## 5. The test that reads the level file

```ts
import { createStorySim } from '../../../src/app/story-sim.ts'
import { Coin } from '../../../src/features/coin/coin.component.ts'
import { placedCoins } from '../../../src/features/coin/coin-items.ts'

it('has one coin for each placed in content/levels/start.af2d.json', async () => {
  const sim = await createStorySim()
  expect(sim.query(Coin)).toHaveLength(placedCoins().length)
  expect(placedCoins().length).toBeGreaterThan(0)
})
```

Then walk the player into the first coin with `Move` commands and expect `coin.collected`. Placing another coin in Levels
changes the game with no code change, which is the point.

## 6. What the person does next

- **Levels:** place more coins.
- **Feel and Audio:** `coin.collected` is in "What happens in the game?" with no code: add a flash or a blip.
- **Tuner:** if the pick-up needs a number (a score per coin), add a row to `content/tuning.toml` and read it through
  `src/shared/tuning.ts`.
