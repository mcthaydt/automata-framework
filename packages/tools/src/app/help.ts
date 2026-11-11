// What `automata --help` and each command's `--help` print. The first screen is short and says what to do; each
// command's own help says what it does in plain words. A first-time game author reads these, so they hold no plan or
// decision IDs, no internal constants, no exit-code paragraphs and no package names.

/** The first screen: one line per command, and where the rest is. */
export const ROOT_HELP = `Usage: automata <command>
  create-game <folder>   Make a new game in a new folder.
  check [folder]         Check a game before you ship it.
  build [folder]         Build a game.
  editor [folder]        Open the editors on a game, play it and publish it.
  ship <command>         Check a build for a place to publish it, and publish it.
  words [key]            Have an AI translate the game's words into every language it ships.
Run automata <command> --help for more.
`

/** The help of \`create-game\`; it lists the 3D template only where the 3D package is found. */
export const createGameHelp = (
  threeD: boolean,
): string => `Usage: automata create-game <folder> [--id <id>] [--title <title>] [--targets <list>]${threeD ? ' [--template <2d|3d>]' : ''}

Makes a new game in <folder>. Run it in your browser with pnpm dev.

  --id <id>         The game's short name: lowercase letters, digits and hyphens. Default: the folder's name.
  --title <title>   The name players see. Default: made from the short name.
  --targets <list>  Where the game will be published, separated by commas (default: web,itch; also tauri, ruken).${
    threeD
      ? '\n  --template <2d|3d>  The kind of game: a square in a level (2d, the default) or Wick in a 3D room (3d).'
      : ''
  }
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

export const WORDS_HELP = `Usage: automata words [key] [--to <language>] [--all] [--mark] [--dir <folder>]

Has an AI translate the game's words into every language the game ships. It translates the words that have no
translation yet and the words whose English changed since they were translated, and leaves the rest alone. Give a
key to translate that one line.

  --to <language>  Translate into that language only, such as ja or pt-BR.
  --all            Translate every word again, even the ones that already have a translation.
  --mark           Do not translate: note that the translations already written match the English now.
  --dir <folder>   The game (default: this folder).
  --catalog <folder>  Work on one folder of words that is not a game's, into the six default languages.
  --source <language> The language the words are written in (default: en).

It needs ANTHROPIC_API_KEY set on this computer. The key is used to reach the translator and nothing else.
`
