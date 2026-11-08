# Runbook

Three procedures: what to do when credentials are lost or stolen, how to rebuild everything from Git, and how the
website goes live. The Owner runs both; an agent never holds these credentials (AGENTS.md).

## Lost credentials

Use this when a laptop, phone or token with access to AF is lost, stolen or pasted somewhere it should not be,
including into an AI chat.

**What counts as production access today.** AF publishes packages only from CI, with the workflow's own
`GITHUB_TOKEN` (`release-packages.yml`), which expires with each run, behind the Owner-approved `release`
environment. Nothing publishes from a laptop. The long-lived credentials are:

| Credential | Where it lives | What it can do |
|---|---|---|
| The Owner's GitHub account (password, sessions, SSH keys, personal access tokens) | GitHub | Everything: push, approve the `release` environment, change settings |
| `RUKEN_TOKEN` | Secrets of each game repository | `ruken publish` for that game |
| `SHIP_DEV_SSH_KEY`, `SHIP_DEV_KNOWN_HOSTS` | Secrets of each game repository | Deploy a game to the dev host |
| The `af-linux` runner registration | The runner PC (`owner-pc-wsl-af`, the Owner's Windows PC under WSL2 Ubuntu-24.04; service `actions.runner.mcthaydt-automata-framework.owner-pc-wsl-af`) | Run the checks, the games' CI and the consumer smoke for this repository (since 2026-10-30, when `AF_LINUX_RUNNER` went back from `af-mac` to `af-linux`) |
| The `af-mac` runner registrations | The Owner's Mac | Run CI jobs and, since 2026-10-30, the release jobs (`release-packages.yml`: version, and publish behind the `release` approval) |
| `NPM_TOKEN` (an npm automation token for the `@automata` organisation) | The `release` environment's secrets (not created yet) | Publish the public packages from `release-packages.yml`; games install them with no token |
| `CLOUDFLARE_API_TOKEN` | This repository's secrets (not created yet) | Upload the website to Cloudflare Pages from `main` (`site.yml`); without it the deploy says "No host configured yet." Create it with only the Pages edit permission for one account |
| `CLOUDFLARE_ACCOUNT_ID` | This repository's variables (not created yet) | Names the Cloudflare account `site.yml` uploads to; not a secret |
| `SKILLS_TOKEN` | This repository's secrets (not created yet) | Push the agent package to `mcthaydt/automata-skills` after each release; without it the release says "No skills token yet." and the mirror waits |

**Do this, in order, from a device you still trust:**

1. **GitHub account.** Change the password. In Settings → Sessions, sign out every other session. In SSH and
   GPG keys and in Developer settings → Personal access tokens, delete every key and token the lost device
   held. Check that two-factor authentication is still yours, and regenerate the recovery codes.
2. **Tokens.** Revoke `NPM_TOKEN` on npmjs.org and create a new automation token for the `@automata` organisation,
   then update the `release` environment's secret. Rotate `RUKEN_TOKEN` in Ruken and the dev host's SSH key in each
   game repository the same way. Games need no token to install AF: its packages are public.
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

Published versions live on npmjs.org, public, under the `@automata` organisation.

**Not in Git, and where each is kept:**

| What | Where it is held | How to restore it |
|---|---|---|
| Repository settings: the `release` environment and its reviewer, rulesets, private vulnerability reporting | GitHub repository settings | Recreate them by hand from this list (the Owner's setup steps are in [the archived delivery plan](archive/02-master-delivery-plan.md)) |
| Repository variables `AF_LINUX_RUNNER`, `AF_GPU_RUNNER` | GitHub repository settings | Unset means `af-linux`; set them only to move jobs (2026-10-30: `AF_LINUX_RUNNER` = `af-linux`; it was `af-mac` from about 2026-10-17) |
| Game repository secrets and variables (`RUKEN_TOKEN`, `RUKEN_API`, `RUKEN_GAME`, `SHIP_DEV_*`) | Each game repository | Create new tokens, as in "Lost credentials" |
| The `af-linux` self-hosted runner | The Owner's PC (WSL2 Ubuntu with Docker) | Register a new runner with the label `af-linux` (Ruken's `docs/self-hosted-runner.md`) |
| The Renovate app installation | GitHub Apps | Install it on the repository again; `renovate.json` holds the configuration |
| The domain `automataframework.com` and its DNS | The registrar | The website's address (`SITE_ORIGIN` in `site/src/lib/site.js`); point it at the site's host again |

**Rebuild, step by step:**

1. Clone the repository on a machine with Git and Node 24.21.0, then `corepack enable` and `pnpm install`.
   If GitHub itself is gone, use any clone: every clone carries the full history.
2. Run `pnpm ci:local`. It checks, builds and tests everything CI does, including parity in three browsers.
   It needs the full history, not a shallow clone, for `pnpm secrets` and `changeset status`.
3. Push to a new GitHub repository, then restore the settings in the table above.
4. If npmjs.org lost the published versions, run the release workflow from `main` again. Changesets
   publishes every version the registry is missing, and `verify-published.ts` checks the result.
5. Record what was rebuilt, and when, in [03 Continuation](archive/03-continuation-prompt.md).

## Launch the website

The website (`site/`) builds and is tested on every pull request inside `ci.yml`'s 2D journeys. From `main`, the
`site` job (`.github/workflows/site.yml`) deploys it to Cloudflare Pages. Every push to `main` after step 7 runs
`pnpm --filter @automata/site check:launch` first and stops if any of these is not true yet: the contact address is not a
personal mailbox and its domain has a mail record, `npx <the first command's package> create-game` finds a package on
npmjs.org, Pixi 3D (`@pixi/3d`) is public, and the repository is public (`REPOSITORY_PUBLIC` in `site/src/shared/site.js`).
So do the steps in this order. Steps marked (Owner) need an account or a decision only the Owner has; the agent does the rest.

1. **(Owner) Register the domain** `automataframework.com` and create the mailbox `hello@automataframework.com`.
2. **(Owner) Create the npm organisation** `automataframework` and the `NPM_TOKEN` secret of the `release` environment.
3. **(Owner) Create the Cloudflare Pages project** `automataframework` (Direct Upload, no Git connection) and attach
   `automataframework.com` to it as its custom domain, with `www` redirecting to the apex and HTTPS on.
4. **The agent: merge the package rename** to `@automataframework/*` (the plan's Task 6), after the open stack has merged.
5. **(Owner) Approve the first release**, 0.1.0, as `first-public-release.md` describes, so the site's first command finds
   its package.
6. **Pixi 3D goes public.** The AF launch task swaps `vendor/pixi-3d/` for the npm release; the Owner opens the
   repository (the go-public checklist); the agent's pull request then sets `REPOSITORY_PUBLIC` to `true` in `site.js`.
7. **(Owner) Add the deploy credentials, last:** the secret `CLOUDFLARE_API_TOKEN` and the variable
   `CLOUDFLARE_ACCOUNT_ID`. Adding them before steps 5 and 6 would make every push to `main` fail `check:launch`. The next
   push to `main` builds, checks, uploads and asks the live host for the site's headers (`check:deployed`), first on the
   deployment address and then on the domain.
8. **(Owner) Look at it** on a phone and on the iPad: the home page, play Emberwick, Start, Try the editor, and the app page.
9. **(Owner) Archive** the `automata-website` repository.

HSTS stays at one day (`security-headers.ts`) until `check:deployed` has passed for seven days. Then a one-line pull
request raises `max-age` to a year, so a broken certificate in the first week cannot lock a reader out for long.

To try the headers before any account exists: `cd site && pnpm host:local` serves `build/` on Cloudflare's own engine
(wrangler), and `pnpm check:deployed http://127.0.0.1:<the port it prints>` asks it the same questions the live check does.


