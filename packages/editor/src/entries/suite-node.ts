// The suite's Node side (`@automata/editor/suite/node`): the runner for the game's own checks, which `automata editor`
// serves to the page. It spawns processes, so it is a separate entry from the page's.
export { type ArgvChecksOptions, createArgvChecks } from '../features/suite/node/argv-checks.ts'
