---
name: automata-api
description: The exact exported API of every published @automata/* package at this version, generated from its .d.ts files. Use to look up a function, type or option before calling it; an export not listed does not exist.
---

# The Automata API at this version

[reference/api.md](reference/api.md) lists every export of every published `@automata/*` entry point, with
its kind, its full TypeScript signature and its doc comment. It is generated from the packages' published `.d.ts`
files at the version its first line states, so it cannot describe an API that isn't there.

## How to use it

- **Before calling a framework function**, search the reference for its heading (for example ``#### `createSim` ``) and use
  the signature as written: parameter names, optional fields and return type.
- **Imports**: each section is headed by the import line to use, such as
  `import { … } from '@automata/sim'`. Import only from the entry points listed; deep imports into a
  package's files are not part of the API.
- **Not listed means it does not exist** in this version. Do not guess a name from another version or another
  framework; find the listed export that does the job, or write the code in the game.
- **No doc comment** (`_No doc comment._`) means the signature is all there is; read the types.
- **Version**: compare the reference's version with the game's `@automata/*` versions in `package.json`.
  If they differ, the reference may be wrong for this game: say so instead of relying on it.

The file is large. Search it for the name you need rather than reading it from the top.
