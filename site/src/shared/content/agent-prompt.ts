// The words a visitor copies to their coding agent, and the command that makes a game: one source for Home's "Copy the
// prompt for your agent" and Start's setup, so the two cannot drift apart.

/** The first command a new author runs. */
export const CREATE_COMMAND = 'npx @automata/tools create-game my-game'

/**
 * How an agent gets Automata's own skills: the public mirror is a plugin marketplace of its own (agents/automata in the
 * framework repository), so Claude Code adds it and installs the plugin, and any agent that reads skill folders installs
 * them with the skills tool. A test holds the Claude Code lines to the mirror's marketplace file.
 */
export const AUTOMATA_PLUGIN_INSTALL = {
  claudeCode: ['/plugin marketplace add mcthaydt/automata-skills', '/plugin install automata@automata'],
  other: 'npx skills add https://github.com/mcthaydt/automata-skills',
} as const

/**
 * What the agent does before it writes code: get Automata's skills, read the game's rules, and say what it loaded. The
 * other collections help but are never a reason to hold the work back.
 */
export const SKILL_PREFLIGHT = `Before coding, install Automata's skills from https://github.com/mcthaydt/automata-skills.
In Claude Code run ${AUTOMATA_PLUGIN_INSTALL.claudeCode[0]} then ${AUTOMATA_PLUGIN_INSTALL.claudeCode[1]}. In another agent run ${AUTOMATA_PLUGIN_INSTALL.other}.
Then read this game's AGENTS.md and the skills it names, and report which skills you loaded.
Superpowers and the official PixiJS v8 skills are also useful: use them if they are installed, and carry on if they are not.
Do not report a skill as installed or loaded without evidence.`

/** What Home's button copies: the ask, the command that makes the game, then the preflight. */
export const AGENT_PROMPT = `I want to make a 2D browser game with Automata (https://automataframework.com).
Make the game with this command, then work in the new folder:
${CREATE_COMMAND}

${SKILL_PREFLIGHT}`
