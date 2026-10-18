---
"@mcthaydt/automata-testing": minor
---

The input × form-factor matrix (M4.10): a new `@mcthaydt/automata-testing/e2e` entry with `FakePad` (a standard controller for a real built game, from FloorFifty's fake gamepad, reachable in the game's frame under a host), the touch helpers `tap`, `hold`, `swipe` and `flick`, and `INPUT_MATRIX`, the M4 spec's cells as data; and `@mcthaydt/automata-testing/input` with `fakeGamepads()`, a `navigator.getGamepads` stand-in for unit tests. `@playwright/test` is an optional peer, needed only by the `e2e` entry. The private runtime and game packages gain the active device following the host's input mode (`makeInput({ hostInput })`) and the "This controller isn't supported yet" toast for a pad without the standard mapping.
