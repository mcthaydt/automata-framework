# Narrative

Conversations and story as data: who says what, what the player can answer, and which short scenes ("storylets") happen
when the world is in the right state. It also ships the tools that check a story for dead ends before a player finds one.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

Narrative needs [`@automata/sectors`](../sectors/README.md) and [`@automata/puzzle`](../puzzle/README.md):

```ts
import { narrativeExtension } from '@automata/narrative'

const narrative = narrativeExtension()
export default defineGame({
  extensions: [sectorsExtension, puzzleExtension({ extensions: ['narrative'] }), narrative.extension],
})
```

Give `narrative.startDialogue` and `narrative.heardVerb` to the puzzle's `dialogue` and `verb` hooks. If a needed
extension is missing, the game refuses to start and names it.

## What you get

- **Six content kinds**: canon, lines, dialogue, storylets, beats and help.
- **Sim**: commands to start, advance and choose, and events for each line, choice, end and storylet.
- **Tools** (`@automata/narrative/tools`, for Node): lint a conversation, find lines nobody can reach, count what a
  test covered, and write a screenplay from the tree.
