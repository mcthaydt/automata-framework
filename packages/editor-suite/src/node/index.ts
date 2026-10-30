// The suite's Node adapters (editor suite spec EDS-D1, EDS.1d): the ports over the game's checkout, git, `gh`, the
// game's own commands and the developer's API key, for `automata editor`. Each is held to the kit's port contract.
export { type ArgvChecksOptions, createArgvChecks } from './argv-checks'
export { type ClaudeAskOptions, createClaudeAsk } from './claude-ask'
export { createGatesReader, type GatesReaderOptions } from './gates-reader'
export { createGitChangeSet, type GitChangeSet, type GitChangeSetOptions } from './git-change-set'
export { type ArgvOptions, type ArgvResult, OUTPUT_CAP, runArgv } from './run-argv'
