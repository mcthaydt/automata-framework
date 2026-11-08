// The one place the app writes the framework's package names. The `@automataframework` rename (audit A5) is an edit
// here and nowhere else; a test fails when another file writes the name.

/** The name every framework package starts with: `@mcthaydt/automata` and `@mcthaydt/automata-<name>`. */
export const FRAMEWORK_PREFIX = '@mcthaydt/automata'
