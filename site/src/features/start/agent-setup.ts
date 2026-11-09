import { SKILL_PREFLIGHT } from '../../shared/content/agent-prompt'

export { SKILL_PREFLIGHT }

// What Start's agent setup says: where each skill comes from, how each agent installs it, and the check to ask the
// agent for before it writes code. Sources were checked on 15 October 2026; upstream instructions win when they change.
export const SKILL_SOURCES = {
  superpowers: 'https://github.com/obra/superpowers#installation',
  pixijs: 'https://github.com/pixijs/pixijs-skills#installing',
  codex: 'https://developers.openai.com/plugins/quickstart',
}
export const PIXIJS_INSTALL = 'npx skills add https://github.com/pixijs/pixijs-skills'
export const AGENT_INSTALL_OPTIONS = [
  {
    name: 'Codex',
    instructions:
      'In the Codex app, open Plugins, find Superpowers and install it. In Codex CLI, use /plugins, search for Superpowers and select Install Plugin.',
    command: '',
  },
  {
    name: 'Claude Code',
    instructions: 'Run this in Claude Code’s command interface, using its official plugin marketplace.',
    command: '/plugin install superpowers@claude-plugins-official',
  },
  {
    name: 'Cursor',
    instructions: 'Run this in Cursor Agent chat, or find Superpowers in its plugin marketplace.',
    command: '/add-plugin superpowers',
  },
  {
    name: 'Another agent',
    instructions:
      'Follow the upstream Superpowers installation section for your harness. Install it separately for each agent you use; do not guess a command for an unsupported tool.',
    command: '',
  },
]
