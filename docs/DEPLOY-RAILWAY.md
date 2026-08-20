# Deploying the Oddsify API to Railway

Migration target for the backend, replacing Render. The database (Neon
Postgres) and the client (Vercel) are unaffected — only the API host moves.

## Why we left Render, and why not Koyeb

Render's Hobby workspace caps free egress at 5 GB/month and suspends the whole
workspace on overage. Koyeb was evaluated first and rejected: following the
Mistral AI acquisition its dashboard no longer offers web-service creation to
new accounts.

**A bigger allowance is headroom, not a fix.** The API serves only JSON and
socket traffic (the frontend is on Vercel), so 5 GB indicates something
pathological — most likely Socket.IO clients stuck on the HTTP long-polling
transport. On Railway egress is billed per GB, so this becomes a recurring
cost rather than a one-time suspension. Diagnose it.

## What this will actually cost

Railway bills **actual usage**, not allocated capacity:

| Resource | Rate |
|---|---|
| RAM | $10 / GB / month |
| CPU | $20 / vCPU / month |
| Egress | $0.05 / GB |

For an always-on Node process with Socket.IO and the background timers,
assuming 200–350 MB resident and light CPU:

```
RAM     0.2–0.35 GB x $10  = $2.00–3.50
CPU     ~0.05 vCPU  x $20  = ~$1.00
Egress  5 GB        x $0.05 = $0.25
                             ---------
                             ~$3.25–4.75 / month
```

Consequences for plan choice:

- **Free ($1/month credit)** will not run this service. At the rates above the
  credit is exhausted in roughly a week. It is not a viable home for the API.
- **Trial ($5, 30 days)** covers about one month. Fine for validating the
  migration, not a destination.
- **Hobby ($5/month, $5 usage included)** is the realistic plan. Expect it to
  be roughly covered, with a small overage if memory runs high.

Watch the metrics tab for the first week and confirm real RSS against the
estimate above — the numbers here are projections, not measurements.

## Build

Deploy from the GitHub repo. [`railway.json`](../railway.json) pins the build to
the root [`Dockerfile`](../Dockerfile) and sets the health check, so the service
needs no manual build configuration.

- Builder: **Dockerfile** (repo root)
- Health check: `GET /api/health`
- `watchPatterns` limits rebuilds to `server/**` and the manifests, so client
  commits do not trigger an API redeploy.

Railway injects `PORT` at runtime; `config/env.js` reads it. Only the `server`
workspace is installed — the client is built separately by Vercel.

## Environment variables

Copy from the Render dashboard. Values marked **secret** are not in
`render.yaml` — read them off Render before tearing the service down.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | **secret** — copy the existing value, see warning below |
| `JWT_ACCESS_TTL` | `30d` |
| `JWT_REFRESH_TTL` | `3650d` |
| `CORS_ORIGIN` | `https://oddsify-client.vercel.app` |
| `CORS_ALLOW_VERCEL` | `oddsify-client` |
| `DATABASE_URL` | **secret** — Neon *pooled* URL, must include `?sslmode=require` |
| `ODDS_API_KEY` | **secret** |
| `ODDS_API_DAILY_BUDGET` | `15` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | **secret** |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | **secret** |
| `RAPIDAPI_FOOTBALL_KEY` | **secret** |
| `RAPIDAPI_FOOTBALL_HOST` | `free-api-live-football-data.p.rapidapi.com` |
| `LIVESCOREAPI_KEY` `LIVESCOREAPI_SECRET` | **secret** |
| `LIVESCOREAPI_DAILY_BUDGET` | `40000` |
| `APIFOOTBALL_KEY` | **secret** |
| `APIFOOTBALL_HOST` | `v3.football.api-sports.io` |

> **Carry `JWT_SECRET` over verbatim.** Render generated it with
> `generateValue: true`. Refresh tokens last 3650 days so users are effectively
> never asked to log in again — issuing a new secret invalidates every existing
> session and logs out your entire user base at once.

> **`DATABASE_URL` must be set.** When it is missing the API silently falls back
> to ephemeral JSON files under `server/data`, which wipes every account on each
> restart. Confirm it is present before sending traffic.

Railway does not expose a public domain by default. Generate one under
**Settings → Networking → Public Networking** to get the `*.up.railway.app` URL.

## Cutover

1. Deploy on Railway, generate the public domain, and note the URL.
2. Verify directly, before touching the client:
   ```
   curl https://<service>.up.railway.app/api/health
   ```
3. Point the client at it. **Both** of these, or you will get a confusing 405 on
   login when one falls back to the dead Render host:
   - Set `VITE_API_BASE` to the Railway URL in the `oddsify-client` Vercel project.
   - Update `BACKEND_ORIGIN` in `client/src/api/apiBase.js` — the single
     fallback constant used when `VITE_API_BASE` is unset.
4. Redeploy the client. Per project setup this is a **manual Vercel CLI deploy
   from the repo root**, not automatic on push.
5. Check login, an admin page, and that live odds tick over the socket.
6. Keep the Render service up until the above passes, then delete it.

## After cutover

- `render.yaml` stays in the repo as the record of required env vars until the
  Railway service is confirmed stable. Delete it once it is.
- Set a usage alert in the Railway dashboard so a traffic spike cannot run up
  an unbounded bill.
- Add the Railway origin to Google OAuth authorised origins if sign-in misbehaves.
- Railway does not idle the service down, so unlike Render free the background
  timers (`startSettlementLoop`, `startAggregator`, `startLiveTrack`,
  `startSportsLiveClock`) now run continuously. That is the main functional win
  of this move: bets settle and odds refresh even with no traffic.
