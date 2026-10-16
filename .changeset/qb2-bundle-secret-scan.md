---
'@mcthaydt/automata-ship': patch
---

`prepare` (and so `publish` and `deploy-dev`) now fails when the build holds a secret: a known key format (Stripe, AWS, GitHub, npm, private keys and others, named by their gitleaks rule IDs), the value of any variable in the game folder's `.env*` files, or a high-entropy quoted string. The error names the file, line, column and byte offset, never the secret. The scanner is exported as `scanTextForSecrets`, `findSecretsInBuild`, `readEnvValues` and `parseEnvFile` (QB.2).
