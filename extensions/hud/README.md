# HUD

The screen a person plays with: what to do next, what they can use right now, and the things they carry. Where each
piece sits, how wide it may be and which words it shows are in one file, not in code, so a person (and soon an editor) can
move them by hand. The game feeds it a small model each frame and says what a press should do; the HUD draws, and decides
nothing.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

The HUD reads the puzzle's conditions to choose the objective line, so it needs [`@automata/puzzle`](../puzzle/README.md):

```ts
import { hudExtension } from '@automata/hud'

export default defineGame({
  extensions: [puzzleExtension(), hudExtension({ file, words, model, actions })],
})
```

`file` is the `hud` file read as content, `words` turns a message key into the words (a key is never shown to a person),
`model` says what to show this frame and `actions` is what a press asks the game to do. If `puzzle` is missing, the game
refuses to start and names it.

## The `hud` file

`content/hud/play.toml`: a piece may appear once, pinned to one of nine places, taking at most a width in pixels (the
screen's width caps it):

```toml
[[pieces]]
kind = "objective"
anchor = "top"
width = 480

[[pieces]]
kind = "prompt"
anchor = "bottom-right"
words = { label = "hud.use" }

[[objective]]
when = [{ has = "key" }]
line = "objective.door"
target = "door"
```

The pieces are `objective`, `prompt`, `inventory`, `examine` and `keypad`. The `objective` rows are an ordered list: the
first whose conditions all hold is the line (`chooseObjective`), and it may name a place to walk to. A mistake in the file
is a sentence that says what is wrong and what is allowed.

## What you get

- **The objective line** and **the prompt**, a 48 px button naming the hotspot in reach; Enter and a pad's confirm press it.
- **Placing** that reads the framework's layout variables and invents no breakpoints, tested at 390 by 844 and 844 by 390.
- **A `hud` content kind**, which the sim never receives.

The layout half (`shared/layout.schema.ts`, `features/layout/place.ts` and the pieces, which are fed by the model) imports
no extension, so it can move to the framework core when a second game, or the UI editor, needs it.
