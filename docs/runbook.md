# Runbook

Two procedures: what to do when credentials are lost or stolen, and how to rebuild
everything from Git. The Owner runs both; an agent never holds these credentials (AGENTS.md).

## Lost credentials

Use this when a laptop, phone or token with access to AF is lost, stolen or pasted somewhere it should not be,
including into an AI chat.

**What counts as production access today.** AF publishes packages only from CI, with the workflow's own
`GITHUB_TOKEN` (`release-packages.yml`), which expires with each run, behind the Owner-approved `release`
environment. Nothing publishes from a laptop. The long-lived credentials are:

| Credential | Where it lives | What it can do |
|---|---|---|
| The Owner's GitHub account (password, sessions, SSH keys, personal access tokens) | GitHub | Everything: push, approve the `release` environment, change settings |
| `AF_READ_TOKEN` (classic token, `read:packages`) | Secrets of each game repository | Install `@mcthaydt` packages from GitHub Packages |
| `RUKEN_TOKEN` | Secrets of each game repository | `ruken publish` for that game |
| `SHIP_DEV_SSH_KEY`, `SHIP_DEV_KNOWN_HOSTS` | Secrets of each game repository | Deploy a game to the dev host |
| The `af-linux` runner registration | The runner PC (`owner-pc-wsl-af`, the Owner's Windows PC under WSL2 Ubuntu-24.04; service `actions.runner.mcthaydt-automata-framework.owner-pc-wsl-af`) | Run the checks, the games' CI and the consumer smoke for this repository (since 2026-10-30, when `AF_LINUX_RUNNER` went back from `af-mac` to `af-linux`) |
| The `af-mac` runner registrations | The Owner's Mac | Run CI jobs and, since 2026-10-30, the release jobs (`release-packages.yml`: version, and publish behind the `release` approval) |
| The npm token for npmjs.org | Not created yet | Will publish the public packages |
| `SKILLS_TOKEN` | This repository's secrets (not created yet) | Push the agent package to `mcthaydt/automata-skills` after each release; without it the release says "No skills token yet." and the mirror waits |

**Do this, in order, from a device you still trust:**

1. **GitHub account.** Change the password. In Settings → Sessions, sign out every other session. In SSH and
   GPG keys and in Developer settings → Personal access tokens, delete every key and token the lost device
   held. Check that two-factor authentication is still yours, and regenerate the recovery codes.
2. **Tokens in game repositories.** Revoke the old `AF_READ_TOKEN`, create a new classic token with
   `read:packages` only, and update the secret in each game repository. Rotate `RUKEN_TOKEN` in Ruken and the
   dev host's SSH key the same way.
3. **Runner.** If the runner PC was lost, remove `af-linux` in Settings → Actions → Runners. Jobs then wait in
   the queue instead of running anywhere else (`ci.yml`).
4. **Check what happened.** Read the security log (Settings → Security log), the Actions runs and the packages'
   version lists for anything you did not do. Deprecate a package version you did not publish, and say so in a
   security advisory.
5. **If a secret reached Git.** Rotating it is the fix; a history rewrite is not. `pnpm secrets` then still
   reports the old commit. Add that one commit to `.gitleaks.toml`'s allowlist with the date it was rotated.
6. **Publish again from CI** if a release was in doubt: merge the next "Version packages" pull request and
   approve the `release` environment.

## Rebuild from Git

Everything that builds, tests and publishes AF is in this repository:

- the code, tests, goldens and replays;
- the lockfile and the pinned versions (`docs/versions.md`);
- Ruken's packages as vendored tarballs (`vendor/ruken/`);
- the workflows, the plans, the specs and the decisions (`docs/`).

Published versions live in GitHub Packages, and from the first public release also on npmjs.org.

**Not in Git, and where each is kept:**

| What | Where it is held | How to restore it |
|---|---|---|
| Repository settings: the `release` environment and its reviewer, rulesets, private vulnerability reporting | GitHub repository settings | Recreate them by hand from this list (the Owner's setup steps are in [the archived delivery plan](archive/02-master-delivery-plan.md)) |
| Repository variables `AF_LINUX_RUNNER`, `AF_GPU_RUNNER` | GitHub repository settings | Unset means `af-linux`; set them only to move jobs (2026-10-30: `AF_LINUX_RUNNER` = `af-linux`; it was `af-mac` from about 2026-10-17) |
| Game repository secrets and variables (`AF_READ_TOKEN`, `RUKEN_TOKEN`, `RUKEN_API`, `RUKEN_GAME`, `SHIP_DEV_*`) | Each game repository | Create new tokens, as in "Lost credentials" |
| The `af-linux` self-hosted runner | The Owner's PC (WSL2 Ubuntu with Docker) | Register a new runner with the label `af-linux` (Ruken's `docs/self-hosted-runner.md`) |
| `AF_RUNNER_PORT_OFFSET` in each runner copy's `.env` | The runner's folder on its machine | Give every copy on one machine its own multiple of 2000 (the PC's three copies use 0, 2000 and 4000; the Mac's two use 6000 and 8000; the Windows runner 10000), so jobs on two copies never meet on a port. A copy with none runs at 0 and meets any other copy on its machine that has none. A test server writes no port of its own: `tooling/repo-hygiene` fails on one, and `tooling/examples-runner` holds every journey port to its copy's 2000-port window |
| The Renovate app installation | GitHub Apps | Install it on the repository again; `renovate.json` holds the configuration |
| The domain `automataframework.com` and its DNS | The registrar | The website's address (`SITE_ORIGIN` in `site/src/shared/site.js`); point it at the site's host again |

**Rebuild, step by step:**

1. Clone the repository on a machine with Git and Node 24.21.0, then `corepack enable` and `pnpm install`.
   If GitHub itself is gone, use any clone: every clone carries the full history.
2. Run `pnpm ci:local`. It checks, builds and tests everything CI does, including parity in three browsers.
   It needs the full history, not a shallow clone, for `pnpm secrets` and `changeset status`.
3. Push to a new GitHub repository, then restore the settings in the table above.
4. If GitHub Packages lost the published versions, run the release workflow from `main` again. Changesets
   publishes every version the registry is missing, and `verify-published.ts` checks the result.
5. Record what was rebuilt, and when, in [03 Continuation](archive/03-continuation-prompt.md).

## Launching the site

The website is built and checked by `site.yml` on every pull request that can change it, and on every push to `main`
the same workflow tries to deploy it. Until the steps below are done, the deploy job prints "No host configured yet."
and passes. These steps are the Owner's; each one says who finishes the rest.

1. **The domain.** Register `automataframework.com` if it is not yours yet. Point its apex at the host you pick in
   step 3 (an `ALIAS`, `ANAME` or flattened `CNAME` record; a plain `CNAME` is not allowed at an apex), make `www`
   redirect to the apex, and turn on HTTPS at the host. `SITE_ORIGIN` in `site/src/shared/site.js` already says
   `https://automataframework.com`.
2. **The mailbox.** Make `hello@automataframework.com`. The footer, Privacy, Terms and `security.txt` all give it
   (`CONTACT_EMAIL` and `SECURITY_EMAIL` in `site/src/shared/site.js`); a test keeps any personal address out. Until it
   exists, mail to it bounces.
3. **The host.** Pick a static host (Cloudflare Pages is the recommendation: free, and it serves a folder as it is).
   Create a deploy token that can publish this one site, and add it as the repository secret `SITE_HOST_TOKEN`.
   Do nothing else: with the token set and no deploy command written, `site.yml` fails with a message that says so, on
   purpose. Tell the agent the host; it writes the deploy command in one pull request, and the next push to
   `main` deploys.
4. **Pixi 3D.** `check:site` fails any build that carries `@pixi/3d`, a closed beta that may not be deployed, so a
   deploy cannot happen until the site's build is free of it. Likewise `REPOSITORY_PUBLIC` in
   `site/src/shared/site.js` is `false`, and the build fails on any link to `github.com/mcthaydt/automata-framework`.
   When the repository is public, set it to `true` and add the links.
5. **The packages.** Create the npm organisation, add `NPM_TOKEN` to the `release` environment and approve the first
   release, so Start's `npx @mcthaydt/automata-tools create-game my-game` works for a stranger. Add
   `SKILLS_TOKEN` for the agent package's mirror.
6. **Look at it.** Open the site and its editor on the iPad. A real-device test is the Owner's.

`pnpm lint:actions` checks the workflows and needs Docker.
