---
'@automataframework/framework': patch
'@automataframework/content': patch
'@automataframework/tools': patch
---

`@automataframework/framework/testing` now exports `fakeClock`, and `@automataframework/framework` exports `systemClock`, so a renderer can time a wait without Effect. `@automataframework/content` adds `compileContentResult` and `@automataframework/tools` adds `manifestOf` and `rukenHeadersOf`, plain-value forms of what the Effect API did.
