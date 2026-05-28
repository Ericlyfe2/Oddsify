# Homepage Pass 1 — Build-out + Brand Artifacts

**Date:** 2026-05-28
**Status:** Approved for planning
**Predecessor context:** First in a series of "north star" chunks decomposed from a full-platform build prompt. Subsequent chunks (routing fill-in, bet slip profit engine, live-betting depth, etc.) are deferred to their own specs.

## Goal

Lift the Oddsify homepage from a competent feature list to a confident first-impression sportsbook surface — without rewriting the stack, changing the existing color system (black + warm cream + gold), or introducing new dependencies beyond a single image-processing library. Finish the rebrand-artifact checklist (PWA manifest, full favicon set, dedicated OG image) at the same time so PWA installability and link-preview quality reach parity with the rest of the brand.

## Non-goals

- No stack migration (stays on Vite + React 18 + plain JS + Express).
- No color palette change. The prompt's "Sportsbook Premium" palette is explicitly overridden by the user's "do not change my UI color" directive. Existing tokens in [client/src/components/odd/tokens.js](../../../client/src/components/odd/tokens.js) and [client/src/styles/app.css](../../../client/src/styles/app.css) remain authoritative.
- No cross-sport mix in the quick-bet strip. Football-only for Pass 1. Cross-sport upgrade is a follow-up if traction warrants it.
- No bet-volume tracking. Trending-by-volume waits for a future chunk.
- No featured-leagues hero cards, live scores ticker, referral card, payment methods strip, casino/virtuals tiles, or 4-column footer in this pass.
- No booking-code format change (stays `AF36513`, not `ODF-XXXXXXX`).

## Deliverables

Four user-visible additions plus a brand-artifact cleanup pass:

1. **`WinnerTicker`** — replaces existing `OddPayoutTicker`; backed by real winning bets with synthetic backfill when sparse; mobile vertical-stack with auto-rotate, desktop horizontal marquee; tap-to-expand.
2. **`StatsStrip`** — 4 animated counters: total bets placed, GHS paid out, players online (24h), live matches now.
3. **`QuickBetStrip`** — horizontal scroll of the next 6 football kickoffs with one-tap 1X2 odds that add directly to the existing bet slip.
4. **Brand artifacts** — PWA `manifest.json`, full favicon size set generated from the existing SVG, dedicated 1200×630 OG image, HTML metadata updated, one remaining `stakepoint` grep match purged.

## Architecture

```
                                              Client (Vite/React)
                                              ─────────────────────
                                              Home.jsx
                                                ├─ OddTopHeader        (existing)
                                                ├─ WinnerTicker        NEW   ◄──┐
                                                ├─ OddPromoBanner      (existing)│
                                                ├─ QuickBetStrip       NEW       │ fetch
                                                ├─ OddCategoryGrid     (existing)│
                                                ├─ OddLeagueRow        (existing)│
                                                ├─ "Live now"          (existing)│
                                                ├─ "Featured upcoming" (existing)│
                                                ├─ StatsStrip          NEW   ◄──┤
                                                └─ Footer              (existing)│
                                                                                 │
Server (Express)                                                                 │
─────────────────────                                                            │
GET /api/bet/recent-wins  ──── betsStore + synthetic backfill ───────────────────┤
GET /api/stats/public     ──── betsStore + txStore + oddsAggregator.liveCount ───┘
                              (both: 30s in-memory cache)
```

Quick-Bet Strip needs no new endpoint — it consumes `fetchMatches('football')` data that Home already fetches.

## Component specs

### 1. `WinnerTicker`

**File:** `client/src/components/odd/WinnerTicker.jsx`
**Replaces:** `OddPayoutTicker` export in [client/src/components/odd/primitives.jsx](../../../client/src/components/odd/primitives.jsx). The old export becomes a thin alias `export const OddPayoutTicker = WinnerTicker;` to avoid breaking anything that imports the old name; remove the alias in a follow-up cleanup.

**Data contract** (`GET /api/bet/recent-wins`)
```jsonc
{
  "wins": [
    {
      "id": "wt-real-abc123",
      "phoneMasked": "024•••671",
      "amountGhs": 54000,
      "betType": "multi",       // "single" | "multi"
      "legs": 8,                // 1 for singles
      "oddsTotal": 47.32,
      "settledAt": "2026-05-28T13:45:12Z",
      "kind": "real"            // "real" | "synthetic"
    }
  ]
}
```

**Server logic** (added to [server/src/routes/bet.js](../../../server/src/routes/bet.js))
- Query `betsStore.all()` filtered to `status === 'won'` AND `settledAt > now - 24h`.
- Look up each bet's user; mask `user.phone` as `<first 3>•••<last 3>` (handles GH phone formats `0XX XXX XXXX` and `+233XX XXX XXXX` — strip non-digits first, then mask).
- Sort real wins by `amountGhs` descending, take up to 15.
- If fewer than 15 real wins, backfill to exactly 15 with synthetic items:
  - Names: pull from `FIRST` + `LAST` arrays in [server/src/db/seedDemo.js](../../../server/src/db/seedDemo.js). They are currently file-local `const`s — implementation step adds `export` to both. Names are used only to keep synthetic items varied; the *displayed* string is always a masked phone, never a name.
  - Phone: generate a fake Ghana phone — pick a 3-digit prefix from `['024','054','055','057','027','026','020','050']` + 7 random digits = 10 digits total. Then mask as `<first 3>•••<last 3>`.
  - Amount distribution: 70% in [50, 5000], 25% in [5000, 50000], 5% in [50000, 250000], all rounded to whole cedis.
  - Bet type: 60% multi (legs 2–10, weighted toward 3–6), 40% single (legs=1).
  - `oddsTotal`: for singles, random 1.45–8.50; for multis, geometric mean ~1.7 raised to legs (clipped to [3, 200]).
  - `settledAt`: random within last 6 hours (recent feels active).
  - `kind: 'synthetic'`.
- 30s in-memory cache; cache key is constant since response is global.

**Component behavior**
- **Mobile (<768px):** vertical stack, exactly 3 items visible, fade-and-slide auto-rotate every 4s (advance window of 3). Pause on tap-and-hold.
- **Desktop (≥768px):** horizontal marquee using the existing `odd-marquee` keyframe from [client/src/styles/app.css](../../../client/src/styles/app.css). Duplicate the items array so the loop is seamless. Pause on hover.
- **Item format:** `📞 024•••671 · GHS 54,000 · Multi (8 legs) · 2m ago`
  - Phone in monospace (`odd-mono` class).
  - Amount via `fmtCedi` from [tokens.js](../../../client/src/components/odd/tokens.js).
  - Bet-type label: `Single` or `Multi (N legs)`.
  - Relative time computed client-side from `settledAt`: under 60s → "just now", under 60m → "Nm ago", over 60m → "Nh ago". Recompute every 30s.
- **Tap-to-expand** (mobile only): tap row → animates open a sub-row below showing `Stake: GHS X · Odds @Y.YY`. Tap again to collapse. Only one expanded at a time. Stake is not in the API; show "—" until backend exposes it (Pass 2 can add).
- **Data lifecycle:** fetch on mount; re-fetch every 60s while `document.visibilityState === 'visible'`; pause when hidden, single re-fetch on regain. Use a small `useVisibilityPolling(fetcher, 60000)` hook (new, can live in `client/src/hooks/`).
- **Accessibility:** `role="region" aria-label="Recent winners"`. Items are `<button>` not `<div>` when tap-to-expand is wired. `prefers-reduced-motion: reduce` → no auto-rotate, no marquee — render top 5 items as a static stacked list.
- **Empty state:** if `wins.length === 0` (rare — server always backfills), hide the entire section.
- **Error state:** silently fall back to the previously hardcoded 5 strings so the page never loses its top band.
- **Tokens:** `T.greenMid` background band (matches the existing `OddPayoutTicker` exactly so the visual rhythm doesn't shift), `T.ink` text, `T.greenBright` for amount/phone accent, `T.danger` for the leading pulse dot.

### 2. `StatsStrip`

**File:** `client/src/components/odd/StatsStrip.jsx`

**Data contract** (`GET /api/stats/public`)
```jsonc
{
  "totalBets": 14302,
  "totalPayoutsGhs": 1248930,
  "activeUsers24h": 627,
  "liveMatches": 12
}
```

**Server** (new file `server/src/routes/stats.js`)
- `totalBets`: `Object.keys(betsStore.all()).length`.
- `totalPayoutsGhs`: sum of `bet.payout` (numeric, fall back to 0) where `bet.status` is `'won'` or `'cashed_out'`, floored.
- `activeUsers24h`: union of distinct `userId` from `betsStore` (where `placedAt > now - 24h`) and `txStore` (where `createdAt > now - 24h`).
- `liveMatches`: read from `oddsAggregator` — if it doesn't already expose `getLiveCount()`, add it returning the size of the current live-match map.
- Mount under `/api/stats` in [server/src/index.js](../../../server/src/index.js). Public, no auth.
- 30s in-memory cache: single `{ value, expiresAt }` slot; recompute on GET after TTL. No need for LRU.

**Component behavior**
- **Layout:** 4 cards in a single row on ≥768px, 2×2 grid below that. Cards have equal width, `T.surface` background, `T.line` 1px border, 16px padding, 12px corner radius.
- **Card content:** small `T.inkSoft` uppercase label (e.g., `BETS PLACED`), then a large display number, then a tiny optional sublabel (e.g., `Today` under "Players online").
- **Count-up animation:** trigger once when the strip first enters the viewport (via IntersectionObserver, threshold 0.4). 1.5s, ease-out cubic, easing from 0 to value. Subsequent re-fetches snap to the new value (no re-animation — avoids the "always counting up" gambling-tackiness).
- **Live matches card:** if `liveMatches > 0`, add a small pulsing `T.danger` dot using the existing `odd-pulse` keyframe.
- **Formatting:** GHS card uses `fmtCedi`. Counts use `toLocaleString('en-GH')`.
- **Data lifecycle:** fetch on mount; re-fetch every 60s while visible; pause when hidden.
- **Loading:** 4 skeleton cards with the same dimensions, 1s shimmer.
- **Error:** silently hide the section; log to console.
- **Accessibility:** `role="region" aria-label="Site statistics"`. Each card is a `<div>` with the count in an `aria-live="off"` `<span>` (count-up should not announce per-tick).
- **Tokens:** `T.surface`, `T.ink`, `T.inkSoft`, `T.greenBright` (numeric), `T.danger` (pulse).

### 3. `QuickBetStrip`

**File:** `client/src/components/odd/QuickBetStrip.jsx`

**Data flow:** consumes Home's existing `matches` state — Home passes `matches` and `onPick` props down. No new fetch, no new endpoint. Component is dumb-presentational.

**Selection logic** (in Home):
```js
const quickBetMatches = useMemo(
  () => matches.filter(m => !m.isLive).slice(0, 6),
  [matches],
);
```
(Already sorted by kickoff in `fetchMatches` response order.)

**Component behavior**
- **Layout:** horizontal scroll, `overflow-x: auto`, snap-to with `scroll-snap-type: x mandatory`. Hides scrollbar via existing `.odd-pane` class.
- **Card:** 280px wide × 144px high (fixed both axes so all cards align in the scroll row). `T.surface` background, `T.line` border, 12px radius, 12px padding. Top row: team names truncated with ellipsis if needed + small kickoff badge ("in 23m" / "Today 19:30"). Bottom row: 3 odds buttons in a horizontal flex (gap 6px, equal width).
- **Odds button:** 44×44 minimum, `T.surfaceAlt` background, `T.ink` text, numeric in `JetBrains Mono`. Label above (`1` / `X` / `2`) in `T.inkSoft`. Tap → calls `onPick({ matchId, market: '1X2', outcome: '1'|'X'|'2', odds })`.
- **Active state:** when the slip already contains this selection, the odds button gets `T.greenBright` 2px border + `T.greenSoft` background. Determined by checking `picks` array passed from Home (existing `picks` shape supported by `SlipProvider`).
- **Empty state:** if `matches` array is empty or zero non-live matches, the component returns `null` (no section rendered, no empty card).
- **Loading state:** if Home is still loading (`loading === true`), render 3 skeleton cards.
- **Accessibility:** each card is `<article aria-label="Arsenal vs Chelsea, kicks off in 23 minutes">`. Each odds button has `aria-label="Bet on Arsenal to win at odds 1.85"`.
- **Tokens:** `T.surface`, `T.surfaceAlt`, `T.ink`, `T.inkSoft`, `T.greenBright`, `T.greenSoft`, `T.line`.

### 4. Brand Artifacts

#### `client/public/manifest.json`
```json
{
  "name": "Oddsify — Premium Sports Betting",
  "short_name": "Oddsify",
  "description": "Sharper odds across 30+ leagues, live & pre-match. Instant MoMo, Vodafone Cash & card deposits.",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/maskable-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

#### Favicon generator: `scripts/build-favicons.mjs`
- Uses [`sharp`](https://www.npmjs.com/package/sharp) pinned to `^0.33.0` (add to root devDeps — scripts run from repo root, not client).
- Reads `client/public/favicon.svg`.
- Writes to `client/public/`:
  - `favicon-16.png` (16×16)
  - `favicon-32.png` (32×32)
  - `favicon-48.png` (48×48)
  - `apple-touch-icon-180.png` (180×180)
  - `icon-192.png` (192×192)
  - `icon-512.png` (512×512)
  - `maskable-icon-512.png` (512×512, with 10% transparent padding on each side — total 20% margin — so content sits inside the 80% safe zone per the [Android maskable spec](https://web.dev/articles/maskable-icon))
- Hooked into the root `package.json` via `"prebuild": "node scripts/build-favicons.mjs && node scripts/build-og-image.mjs"` (the root `build` script delegates to client, so the root `prebuild` runs first and writes generated assets into `client/public/` before Vite copies them to `dist/`). Idempotent — re-running produces the same bytes given the same input.

#### OG image generator: `scripts/build-og-image.mjs`
- Generates `client/public/og-image.png` at 1200×630.
- Composition: solid `#0a0a0a` background, large radial gold gradient anchored bottom-right (`rgba(232,185,74,0.18)` → transparent), `Oddsify` wordmark center-left (Space Grotesk equivalent — embed system fallback if no font is available; the wordmark SVG already exists in `OddsifyWordmark` component, render its path), tagline "Premium Sports Betting · Ghana" below in `T.inkSoft`, 18+ chip bottom-left.
- Implementation: use `sharp` with SVG composition (build an SVG string in memory, then `.png()`-encode).
- Idempotent.

#### HTML updates ([client/index.html](../../../client/index.html))
- Add `<link rel="manifest" href="/manifest.json" />`.
- Replace single `<link rel="icon">` with:
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
  ```
- Replace `apple-touch-icon` to point at `/apple-touch-icon-180.png`.
- Change `og:image` from `/apple-touch-icon.svg` to `/og-image.png`. Add `og:image:width` and `og:image:height` metadata (1200, 630).

#### Stakepoint sweep
- Run `grep -rni stakepoint` across the repo. Fix the one stray match found in the audit. If more appear (some files weren't covered by the first grep), fix all of them.

## Endpoints (full list of new server routes)

| Method | Path | Auth | Cache | Returns |
|---|---|---|---|---|
| GET | `/api/bet/recent-wins` | none | 30s in-memory | `{ wins: WinItem[] }` (≤15) |
| GET | `/api/stats/public` | none | 30s in-memory | `{ totalBets, totalPayoutsGhs, activeUsers24h, liveMatches }` |

Both endpoints are read-only and idempotent. No rate-limiting needed beyond the existing global limiter.

## Client API additions ([client/src/api/betApi.js](../../../client/src/api/betApi.js))

```js
export const fetchRecentWins  = () => get('/bet/recent-wins');
export const fetchPublicStats = () => get('/stats/public');
```
(Note: stats endpoint is mounted at `/api/stats` not `/api/bet`, so the second call needs the full path. The existing `get()` helper uses the `API_BASE = '/api'` prefix, so `get('/stats/public')` → `/api/stats/public`. Confirmed compatible.)

## Home.jsx restructure ([client/src/pages/Home.jsx](../../../client/src/pages/Home.jsx))

Replace the body of the return JSX with the new section order. Sketch:

```jsx
return (
  <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 120 }}>
    <OddTopHeader ... />
    <WinnerTicker />                                          {/* NEW */}
    <OddPromoBanner ... />
    <QuickBetStrip matches={matches} loading={loading}
                    picks={picks} onPick={togglePick} />       {/* NEW */}
    <OddCategoryGrid ... />
    <OddLeagueRow ... />
    <SectionHeader title="Live now" .../>
    <MatchList ... />
    <SectionHeader title="Featured upcoming" .../>
    <MatchList ... />
    <StatsStrip />                                            {/* NEW */}
    <Footer ... />
  </div>
);
```

`OddPayoutTicker` import is replaced by `WinnerTicker`. The old export remains as an alias for one release for backward compatibility.

## Testing

**Manual smoke (run locally on `npm run dev`):**
- Open `http://localhost:5173/` — verify WinnerTicker animates, StatsStrip counts up on scroll, QuickBetStrip shows 6 cards with tappable odds.
- Click an odds button in QuickBetStrip → confirm bet slip opens with the selection.
- DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → verify ticker becomes static list, stats render without count-up.
- DevTools → Toggle Device Toolbar → 360×800 (iPhone SE) → verify mobile breakpoints work (StatsStrip becomes 2×2, ticker becomes vertical stack).
- DevTools → Network → throttle to "Slow 3G" → verify skeleton states appear, then content swaps in.

**Endpoint smoke:**
```bash
curl http://127.0.0.1:4000/api/bet/recent-wins  | jq '.wins | length'
curl http://127.0.0.1:4000/api/stats/public     | jq
```

**Build smoke:**
```bash
npm run build
ls client/dist/  # confirm favicons + manifest + og-image present
```

**Lighthouse:** run mobile audit against the built `dist/`. Target: no regression on Performance, Best Practices, SEO, Accessibility. PWA score should rise (manifest + icons now present).

## Risks & rollback

| Risk | Mitigation |
|---|---|
| `sharp` install fails on some platforms (binary issue) | Pin to a known-good version; document fallback in README; favicons not generated → existing SVG favicon still works |
| Stats endpoint slow due to full-store scan on every cache miss | 30s cache + JSON store is small (<10k bets in dev seed) → measured cost is sub-1ms. Re-evaluate if store grows past 1M rows |
| Synthetic ticker items detected and called out as fake | Synthetic only fills the gap below 15 real items; once site has traffic, ticker becomes 100% real; `kind` field is internal-only, never sent to display |
| QuickBetStrip pulling from same `fetchMatches` as the rest of Home means a slow fetch blocks both | Existing behavior — no change. Skeleton already covers it |
| Brand artifact build step adds time to `vite build` | `sharp` operations on 7 small images < 2s total |

**Rollback:** every new piece is additive. To roll back, revert the Home.jsx restructure (one file), remove the new component files, remove the new server routes, restore the old single `<link rel="icon">` line in index.html. All other repo state stays clean.

## Acceptance gates

- [ ] `npm run dev` boots cleanly, no new console errors on home page load.
- [ ] WinnerTicker shows ≥10 items (real, synthetic, or mix); items rotate on mobile, marquee on desktop.
- [ ] StatsStrip 4 cards visible, numbers > 0 (demo seed populates), count-up animates on first scroll into view.
- [ ] QuickBetStrip shows 6 football matches; tapping an odds button adds it to the slip; active state reflects slip contents.
- [ ] `curl /api/bet/recent-wins` returns valid JSON with `wins.length > 0`.
- [ ] `curl /api/stats/public` returns valid JSON with all 4 keys present.
- [ ] `client/dist/manifest.json` + favicon PNGs + `og-image.png` present after build.
- [ ] `<link rel="manifest">` resolves in the deployed HTML.
- [ ] `grep -rni stakepoint` across `client/`, `server/`, `docs/`, root configs returns zero matches (excluding `node_modules` and `docs/superpowers/specs/` historical files).
- [ ] Lighthouse mobile run: no regression vs. baseline; PWA score improves.
- [ ] Tested at 360px, 768px, 1280px widths without layout breakage.
- [ ] `prefers-reduced-motion` honored in WinnerTicker and StatsStrip.

## What's explicitly NOT in this spec (handled in future chunks)

- Real wins should also include `stake` and per-leg detail when expanded — server doesn't expose those on the recent-wins endpoint yet, so the expand row shows `—`. Pass 2 can extend.
- Cross-sport QuickBetStrip mix.
- Featured-leagues hero cards.
- Live scores ticker (separate component).
- Trending matches (needs bet-volume metric in server).
- Referral card, payment methods strip, casino/virtuals tiles on home.
- 4-column footer.
- Booking-code format change to `ODF-XXXXXXX`.
- Stack migration to Next.js / TS / Prisma / Postgres / Redis.
- Real provider integrations (SportRadar, MoMo, etc.).
