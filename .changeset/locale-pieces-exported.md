---
'@automataframework/framework': patch
'@automataframework/ui-screens': patch
'@automataframework/net-ui': patch
---

`@automataframework/framework` exports the locale pieces a game with its own words needs: `bindWords` (keeps `data-word` and `data-word-label` elements of a plain-DOM panel in the player's language, and fills them again when it changes), `matchLocale` (the rule the runtime chooses a language by), `formatNumber` and `DEFAULT_LOCALES`. `@automataframework/ui-screens` and `@automataframework/net-ui` use `matchLocale` instead of their own copy of the rule.
