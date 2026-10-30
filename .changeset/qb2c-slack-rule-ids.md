---
'@mcthaydt/automata-ship': patch
---

The bundle secret scan reports a Slack token under gitleaks' own rule IDs, by prefix: `slack-bot-token` (`xoxb-`), `slack-user-token` (`xoxp-`), `slack-legacy-token` (`xoxs-`) and `slack-legacy-workspace-token` (`xoxa-`, `xoxr-`), instead of `slack-token`, which gitleaks 8.30.1 does not have. It finds the same strings as before and still calls each one "a Slack token"; only a Slack finding's `rule` changes.
