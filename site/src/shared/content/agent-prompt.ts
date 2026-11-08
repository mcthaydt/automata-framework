// The words a visitor copies to their coding agent, and the command that makes a game: one source for Home's "Copy the
// prompt for your agent" and Start's setup, so the two cannot drift apart.

/** The first command a new author runs. */
export const CREATE_COMMAND = 'npx @automata/tools create-game my-game'

/** The check an agent runs before it writes code: which skills it has loaded, and where to read the game's rules. */
export const SKILL_PREFLIGHT = `Before coding, check the skills available in this agent session.
Confirm Superpowers is installed, including using-superpowers and its planning/testing workflows.
Confirm the official PixiJS v8 skill collection is installed, including the pixijs router and relevant rendering skills.
Read the applicable SKILL.md files and report their loaded paths or plugin names.
If either collection is missing or cannot be loaded, stop and follow its upstream installation instructions before implementing.
Then read this game's README.md and the package types.
Do not report a skill as installed or loaded without evidence.`

/** What Home's button copies: the ask, the command that makes the game, then the preflight. */
export const AGENT_PROMPT = `I want to make a 2D browser game with Automata (https://automataframework.com).
Make the game with this command, then work in the new folder:
${CREATE_COMMAND}

${SKILL_PREFLIGHT}`
