---
'@mcthaydt/automata-ui': patch
---

M4.5 focus, back and cursor: `FocusNavigator` gains `steer` (spatial inside a `[data-focus-grid]`, DOM order elsewhere), `page`, `adjust` and the keyboard repeat `guard`. New exports: `sendBack` and `interceptBackGesture` (the system back gesture as Back, history key `afBackGuard`), `CursorRunner`, `cursorHidden` and `CURSOR_IDLE_MS` (an idle pointer hides on `gameplay` screens only), and the paging helpers `isTap`, `releaseStep`, `WheelPager` and `PAGE_SWIPE`. Additive.
