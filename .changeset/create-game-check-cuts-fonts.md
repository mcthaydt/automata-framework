---
'@automataframework/tools': patch
---
A game made with `create-game` runs `pnpm fonts` before `pnpm check`, so the check's build finds the font faces `src/main.ts` imports. Before, a fresh game's `pnpm check` failed at the no-eval step until `pnpm dev` or a build had cut the fonts once.
