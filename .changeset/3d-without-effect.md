---
'@automata/framework': patch
'@automata/content': patch
'@automata/tools': patch
---

`@automata/framework/testing` now exports `fakeClock`, and `@automata/framework` exports `systemClock`, so a renderer can time a wait without Effect. `@automata/content` adds `compileContentResult` and `@automata/tools` adds `manifestOf` and `rukenHeadersOf`, plain-value forms of what the Effect API did.
