# AF dev host

The standalone dev host for AF games (ship spec §3.5, decision D-4): a second Caddy site on the FloorFifty staging VM. Each build is served at `/builds/<buildId>/` with the headers Ruken would serve it with, and `/` redirects to the live build. Adapted from FloorFifty's `deploy/` and `docs/release.md`.

| File | Installed as | What it does |
|---|---|---|
| `caddy/Caddyfile` | a site block appended to `/etc/caddy/Caddyfile` (keep the global block once) | Serves the builds, `builds/index.json` and the live redirect |
| `bin/deploy` | `/usr/local/lib/automata/bin/deploy` | Installs one build from a tarball or stdin; `--activate` makes it live |
| `bin/render-headers.ts`, `bin/builds-index.ts` | beside `deploy` | Run by `deploy` with the VM's Node 24 |
| `bin/ssh-deploy` | beside `deploy` | The `deploy` key's forced command |

## Install once (the Owner)

1. `sudo install -d -o root -m 755 /usr/local/lib/automata/bin /srv/automata/placeholder` and copy the four `bin/` files there (`install -m 755`).
2. `/etc/automata/dev-host.env` (read by `deploy`): `SHIP_ROOT=/srv/automata/placeholder`, `SHIP_BASE_URL=https://af-dev.floorfifty.duckdns.org`.
3. Caddy's environment (FloorFifty's `/etc/floor-fifty/caddy.env` pattern) gains `AF_DEV_SITE=af-dev.floorfifty.duckdns.org`, `SHIP_ROOT=/srv/automata/placeholder` and `AF_ACME_EMAIL`. Point the DNS name at the VM.
4. sudoers: `deploy ALL=(root) NOPASSWD: /usr/local/lib/automata/bin/deploy`.
5. `~deploy/.ssh/authorized_keys`: `command="/usr/local/lib/automata/bin/ssh-deploy",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding <CI public key>`.
6. Validate in `/etc/caddy` (imports are relative to the Caddyfile), then reload: `sudo -E caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.

## Use

- From a game: `automata-ship deploy-dev [--activate]` with `SHIP_DEV_TARGET=deploy@<host>` and `SHIP_DEV_URL=https://<host>`.
- What is installed: `https://<host>/builds/index.json`. What is live: `cat /srv/automata/<game>/live`.
- A build ID is never replaced. Builds are not pruned in M1.
