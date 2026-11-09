// What another package's suite tests borrow from the suite (`@automataframework/automata-editor/suite/testing`): the stand-in editor
// that gives the shell a second tab. Component tests in jsdom load this, so it holds nothing that needs a real browser;
// the layout helpers are in `./suite/testing/layout`.
export { fixtureEditor } from '../testing/suite/fixture-editor'
