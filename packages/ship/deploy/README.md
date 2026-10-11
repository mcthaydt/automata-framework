# AF dev host

The standalone dev host for AF games (ship spec §3.5, decision D-4): a second Caddy site on the FloorFifty staging VM. Each build is served at `/builds/<buildId>/` with the headers Ruken would serve it with, and `/` redirects to the live build. Adapted from FloorFifty's `deploy/` and `docs/release.md`.

| File | Installed as | What it does |
|---|---|---|
| `caddy/Caddyfile` | a site block appended to `/etc/caddy/Caddyfile` (keep the global block once) | Serves the builds, `builds/index.json` and the live redirect |
| `bin/deploy` | `/usr/local/lib/automata/bin/deploy` | Installs one build from a tarball or stdin; `--activate` makes it live |
| `bin/render-headers.ts`, `bin/builds-index.ts` | beside `deploy` | Run by `deploy` with the VM's Node 24 |
| `bin/ssh-deploy` | beside `deploy` | The `deploy` key's forced command |

## Install once (the Owner)

1. `sudo install -d -o root -m 755 /usr/local/lib/automata/bin /srv/automata/placeholder /srv/automata/placeholder/builds /srv/automata/placeholder/live.d` and copy the four `bin/` files there (`install -m 755`). Create the empty live redirect too: `sudo install -m 644 /dev/null /srv/automata/placeholder/live.d/live.caddy`. The Caddyfile imports `live.d/*.caddy`, a glob, so Caddy, and FloorFifty's site with it, starts even without it; the file just makes the state explicit. Put nothing else in `live.d/`.
2. `/etc/automata/dev-host.env` (read by `deploy`): `SHIP_ROOT=/srv/automata/placeholder`, `SHIP_BASE_URL=https://af-dev.floorfifty.duckdns.org`.
3. Caddy's environment, `/etc/floor-fifty/caddy.env` (FloorFifty's `caddy-env.conf` drop-in gives it to `caddy.service`), gains `AF_DEV_SITE=af-dev.floorfifty.duckdns.org`, `SHIP_ROOT=/srv/automata/placeholder` and `AF_ACME_EMAIL`. Point the DNS name at the VM. `deploy` reads the same file itself before `caddy validate` and `caddy reload`, because sudo drops the deploy user's environment and Caddy would otherwise refuse the empty site address.
4. sudoers: `deploy ALL=(root) NOPASSWD: /usr/local/lib/automata/bin/deploy`.
5. `~deploy/.ssh/authorized_keys`: `command="/usr/local/lib/automata/bin/ssh-deploy",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding <CI public key>`.
6. Validate with Caddy's own environment, then reload: `sudo bash -c 'set -a; . /etc/floor-fifty/caddy.env; caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile' && sudo systemctl reload caddy`. This reload is FloorFifty's too: never reload after a failed validate.

## Use

- From a game: `automata-ship deploy-dev [--activate]` with `SHIP_DEV_TARGET=deploy@<host>` and `SHIP_DEV_URL=https://<host>`.
- What is installed: `https://<host>/builds/index.json`. What is live: `cat /srv/automata/<game>/live`.
- A build ID is never replaced. Builds are not pruned in M1.
- One deploy runs at a time per game (`flock` on `<SHIP_ROOT>/.deploy.lock`); a second waits up to 120 s, then exits 5.
- A build tarball may hold only regular files and folders inside the build; links, devices, `..` and absolute names are refused (exit 2) before anything is extracted. Owners and modes in the tarball are ignored: files land as root's, `644`, folders `755`.
- If Caddy rejects the new config (exit 4) or fails to reload it (exit 6), the build is removed and the previous `live.d/live.caddy` and `live` are put back; after a failed reload Caddy is reloaded again with them.
- `deploy` exits 7 when `caddy.env` and `dev-host.env` name different `SHIP_ROOT`s.
