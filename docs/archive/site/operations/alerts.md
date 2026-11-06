# Website alerts: uptime, certificate expiry and spend (QB.4b)

Three alerts watch the deployed site. The site has not been deployed yet: deploys stay dry runs until the project is
complete, and the Owner has not supplied the host, a deploy credential or DNS for `automata.ruken.com` (decision 11).
So none of these alerts exists yet. This page is what to set up once the host exists, and the check behind the first two.

| Alert | Watches | Fires when | Set up by |
| --- | --- | --- | --- |
| Uptime | `https://automata.ruken.com/`, from outside the host, every 5 minutes | `/` does not answer 200 within 10 s, twice in a row | the Owner: an uptime monitor account and an alert recipient |
| Certificate expiry | the certificate the origin presents, daily | fewer than 21 days left, or expired | the Owner: the same monitor (most have a certificate check), or the scheduled check below |
| Spend | the hosting account's bill | the month's forecast passes the budget the Owner sets | the Owner: a billing alert in the hosting account; later the same for the Plus store and the GPU runner |

The 21-day threshold sits under the usual 30-day automatic renewal window, so a renewal that has silently failed is
caught with three weeks to fix it.

## The check

`pnpm check:uptime <origin> [--min-cert-days 21]` checks that `/` answers 200 within 10 s, that the origin is https, and
that the certificate has at least 21 days left. It exits 1 and names each problem, so a monitor that runs commands, or
a scheduled workflow, can alert on the exit code. Before the host exists, `pnpm check:uptime --local [--build build]`
serves the build with `serve-static.ts` and checks the status only (a local server has no certificate).
`tests/check-uptime.test.ts` checks the certificate logic against a real TLS handshake with a short-lived certificate
made by `openssl`.

Not added yet: a scheduled workflow. A schedule against a host that does not exist would only fail, and an external
check should not run on the Owner's Mac, which is the CI runner. When the origin exists, either the Owner's monitor
runs these checks, or a scheduled job off that machine runs `pnpm check:uptime https://automata.ruken.com`.

## Dry run, 2026-10-31

The build was `main` at `776d3d7`, with the framework at `framework.ref` `f8023a9`, on the website lane's Linux container.

```
$ pnpm check:uptime --local
http://127.0.0.1:<port>/ answered 200 (the local build; no certificate was checked).
```
