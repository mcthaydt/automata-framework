// What `automata --help` and each command's `--help` print. The first screen is short and says what to do; each
// command's own help says what it does in plain words. A first-time game author reads these, so they hold no plan or
// decision IDs, no internal constants, no exit-code paragraphs and no package names.

/** The first screen: one line per command, and where the rest is. */
export const ROOT_HELP = `Usage: automata <command>
  create-game <folder>   Make a new game in a new folder.
  check [folder]         Check a game before you ship it.
  build [folder]         Build a game.
  editor [folder]        Open the level editor on a game.
  ship <command>         Check a build for a place to publish it, and publish it.
Run automata <command> --help for more.
`

export const CREATE_GAME_HELP = `Usage: automata create-game <folder> [--id <id>] [--title <title>] [--targets <list>]

Makes a new game in <folder>. Run it in your browser with pnpm dev.

  --id <id>         The game's short name: lowercase letters, digits and hyphens. Default: the folder's name.
  --title <title>   The name players see. Default: made from the short name.
  --targets <list>  Where the game will be published, separated by commas (default: web,itch; also tauri, ruken).
`

export const CHECK_HELP = `Usage: automata check [folder] [--sim-only] [--fail-fast] [--csp] [--json] [--only <step>]

Checks a game one step after another and says what to fix. <folder> is the game (default: this folder).

  boundaries    the game's code is in the right places, and its simulation is repeatable
  typecheck     the code has no type errors
  test          the game's own tests pass
  boards        every leaderboard the code uses is listed in ship.config.ts
  orientation   the way the game turns on a phone matches ship.config.ts
  inputs        the controls the code reads match ship.config.ts
  levels        a level and the game files saved from it match (for a game whose editor list sets exports)
  no-eval       the build runs without eval (it builds the game to find out)
  secrets       no key or password ended up in the build
  data-urls     no picture or sound was folded into the code as a data: link

  --sim-only    Run only boundaries, typecheck and tests.
  --fail-fast   Stop at the first step that finds a problem.
  --csp         Also open the build in a browser under strict security rules.
  --json        Print the report as JSON, for other tools.
  --only <step> Run just that step, named as in the list above.

Exit status: 0 everything passed, 1 something needs fixing, 2 a tool could not run.
`

export const BUILD_HELP = `Usage: automata build [folder] [--debug]

Builds a game with its own Vite build. <folder> is the game (default: this folder).
A normal build leaves out the game's developer-only tools. --debug keeps them in.
`
