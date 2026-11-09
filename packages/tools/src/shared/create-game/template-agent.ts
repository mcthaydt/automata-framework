import { SQUARE_WHERE } from './create-game-targets.ts'
import type { TemplateFile } from './template-file.ts'

// What a coding agent finds in a new game's folder before it reads any code: a page of rules that works with or
// without the Automata plugin (AGENTS.md), one line for Claude Code (CLAUDE.md), and the settings that make Claude Code
// offer the plugin the first time the folder is trusted. The skills' public home is a mirror that is its own plugin
// marketplace (agents/automata/.claude-plugin/marketplace.json), so these two names are the only place that changes
// if the repository moves.

/** The GitHub repository that mirrors the agent package after each release. */
export const AUTOMATA_SKILLS_REPO = 'mcthaydt/automata-skills'

/** The marketplace the mirror is, and the plugin it lists (`automata@automata`). */
export const AUTOMATA_MARKETPLACE = 'automata'

/** What a person places or tunes in a game with 2D levels. */
const PLACED_2D = `- A thing a person places (a coin, an enemy): a definition in the level project (Characters) and items in
  \`content/levels/*.af2d.json\` (Levels). Spawn one entity per placed item with \`entitiesOf\`, draw it with
  \`pictureView\`, and list its definition in \`live\` in \`levelScene\` so the game does not draw it twice.`

/** What the story adds: words, scenes and characters that think. */
const STORY_ROWS = `- Words: a line key in \`content/lines/*.toml\`, shown with \`wordsOf\` from \`@automata/narrative\`. Never a string in code.
- A scene or a character who thinks: scenes are \`content/cutscenes/*.toml\` (Sequence), and behaviour is
  \`content/systems/*.toml\` and \`content/nav/*.toml\` (Schematic). Name a character by its placed id.`

/** The 3D rows: where a 3D game's room and people live. */
const PLACED_3D = `- A thing a person places: the room in \`content/levels/*.af-sector.json\` (Levels 3D); the people in
  \`content/figure*/*.toml\` (Characters 3D).`

const SHARED_ROWS = `- A number a person tunes: a row with a range in \`content/tuning.toml\` and a field in \`src/shared/tuning.ts\`. Never a
  constant in a sim file.
- A sound or a shake: emit a \`defineEvent\` from a \`.event.ts\` file. Feel and Audio list it by themselves.`

/** The three agent files; `where` is the kind's folder table and `contract` its content rows. */
function agentFiles(where: string, contract: string): readonly TemplateFile[] {
  return [
    {
      path: 'AGENTS.md',
      content: (options) => `# ${options.title}

A small web game made with Automata Framework: a deterministic simulation that PixiJS draws. You write how the game
behaves. The person you build it for changes what is in it, in the editors (\`pnpm editor\`).

## Rules that matter here

- Only the sim changes gameplay. Files ending \`.component.ts\`, \`.system.ts\`, \`.command.ts\`, \`.event.ts\` and
  \`.plugin.ts\` read no clock, no file and no network, and never call \`Math.random\`: use the sim's seeded random.
- Pictures only observe the sim. A view never decides anything.
- What a person may want to change is content, never a number in code (see below).
- Write the test first, in \`tests/unit/<feature>/\`, and watch it fail for the right reason.
- One folder for each thing in the game: \`src/features/<name>/\`. A feature imports only itself and \`src/shared/\`.
  Files are kebab-case with a role suffix.

## Where things are

${where}

## Give the editors something to edit

Content is a file an editor writes and the game reads. When you add a feature, ask what a person should change:

${contract}

The \`automata-content\` skill has this as a table and a worked example (a coin a person places in Levels).

## Check your work

\`pnpm check\` runs the types, the sim rules, the content and the tests. Run it before you say a change is done.
Commit when \`pnpm check\` passes. The person's saves from the editors are in the same folder, so one history holds both.

## Get the Automata skills

They hold the exact API, the content contract and the checks. This page is enough to work without them.

- In Claude Code: this folder offers them when you trust it. To add them yourself, run
  \`/plugin marketplace add ${AUTOMATA_SKILLS_REPO}\`, then \`/plugin install ${AUTOMATA_MARKETPLACE}@${AUTOMATA_MARKETPLACE}\`.
- Any other agent: \`npx skills add https://github.com/${AUTOMATA_SKILLS_REPO}\`.
`,
    },
    { path: 'CLAUDE.md', content: () => '@AGENTS.md\n' },
    {
      path: '.claude/settings.json',
      content: () =>
        `${JSON.stringify(
          {
            extraKnownMarketplaces: {
              [AUTOMATA_MARKETPLACE]: { source: { source: 'github', repo: AUTOMATA_SKILLS_REPO } },
            },
            enabledPlugins: { [`${AUTOMATA_MARKETPLACE}@${AUTOMATA_MARKETPLACE}`]: true },
          },
          null,
          2,
        )}\n`,
    },
  ]
}

/** The agent files of the plain 2D game. */
export const AGENT_FILES_2D: readonly TemplateFile[] = agentFiles(
  SQUARE_WHERE,
  `${PLACED_2D}\n${SHARED_ROWS}`,
)

/** The agent files of the 2D game with the story; `where` is the plain game's table and the story's lines. */
export const agentFilesStory = (where: string): readonly TemplateFile[] =>
  agentFiles(where, `${PLACED_2D}\n${SHARED_ROWS}\n${STORY_ROWS}`)

/** The agent files of the 3D game; `where` is its table. */
export const agentFiles3d = (where: string): readonly TemplateFile[] =>
  agentFiles(where, `${PLACED_3D}\n${SHARED_ROWS}\n${STORY_ROWS}`)
