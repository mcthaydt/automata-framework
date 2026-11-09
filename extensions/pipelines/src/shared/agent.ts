import type { Env } from './redact.ts'

// Who is running `automata-pipe`: a person or an agent. Gates are decided by people only, so
// the router refuses an agent's `approve` and `reject`. Claude Code sets CLAUDECODE=1 in the environment of every
// command its agent runs; AUTOMATA_AGENT=1 is the variable any other agent's runner sets.

export const AGENT_VARIABLES: readonly string[] = ['CLAUDECODE', 'AUTOMATA_AGENT']

/** True when the environment says an agent started this process. */
export function isAgent(env: Env): boolean {
  return AGENT_VARIABLES.some((name) => env[name] === '1')
}
