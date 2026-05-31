# Deposit Modal Redesign — Paystack + Paybill (UI-only)

**Date:** 2026-05-31
**Branch:** `feat/admin-user-dm` (to spin off `feat/deposit-paystack-paybill`)
**Status:** Spec — pending review

## Goal

Refresh the deposit modal to match the supplied reference layout while reducing the available payment methods from three (Mobile Money / Paybill / Card) to two (**Paystack** / **Paybill**). This is a **UI-only** change — no real Paystack gateway is integrated. The "Paystack" submission reuses the existing pending-admin-approval flow already powering `momo` deposits.

## Out of scope

- Real Paystack SDK integration, webhook handling, charge verification.
- Backend re-architecture of the deposit/settlement pipeline.
- Changes to the admin Deposits queue UI.
- Withdraw screen changes.
- Mobile money network picker (MTN / Telecel / AirtelTigo). Removed entirely.

## Reference

The reference screenshot shows a deposit screen with:

- Green header bar with title, help icon, and avatar.
- "Choose payment method" subtitle.
- A 2-column grid of three method tiles (Paystack, Nigeria Payment, Bitcoin).
- An account-phone row with phone icon.
- A right-aligned `Balance (GHS) ¢ {n}` row.
- An "Amount (GHS)" card with a `min. 300` hint and a big borderless number input.
- A 5-button preset grid: `300 / 500 / 2,000 / 5,000 / 10,000` that **sets** the amount.

We adopt this layout for Oddsify with only **two** tiles and Oddsify's existing token system / `TxHeader`.

## Architecture

### Where the change lives

- **Single component touched (frontend):** [client/src/providers/AccountProvider.jsx](../../../client/src/providers/AccountProvider.jsx). The `<dialog ref={depositDlg} className="deposit-dlg">` body is rewritten. Everything outside the dialog (toasts, socket handlers, `openDeposit()` API, deposit-result modal, balance pushes) is untouched.
- **Styles:** small additions in [client/src/styles/app.css](../../../client/src/styles/app.css) for the new tile component (`.dep-tile`, selected state, grid).
- **Backend (one-line widen):** [server/src/routes/wallet.js](../../../server/src/routes/wallet.js) — the `depositSchema` method enum must accept `'paystack'`. Existing `momo` / `paybill` / `card` values can stay (back-compat) or be pruned; pruning is preferred since the UI no longer emits them.

### What's preserved

- `openDeposit()` / `submitDeposit()` API on `AccountProvider`.
- `apiDeposit(amount, method)` POST to `/api/wallet/deposit`.
- The `'deposit:approved'` / `'deposit:rejected'` socket events and the queued `DepositResultModal` chain.
- The `TxHeader` (back / forward / help / home wiring).
- The `PaybillInstructions` component (paybill ID `222000`, account ref = user phone/email).
- Min/max bounds: `MIN_DEPOSIT = 300`, `MAX_DEPOSIT = 50000`.

### What's removed

- `depositTab` state (`'momo' | 'paybill' | 'card'`).
- `depositMethod` state when used to mean "MTN / Telecel / AirtelTigo".
- The `networks` map (MTN / Telecel / AirtelTigo) inside the dialog IIFE.
- The "Mobile Money" tab body (account phone row already exists in the new layout; network tag, "Switch" carousel, momo presets are all gone).
- The "Card" tab body and its "coming soon" placeholder.
- The 3-tab strip (`.tx-tabs`) at the top of the dialog.

## Component design

### State (inside `AppProviders`)

Replace the three deposit-tab/method states with one:

```js
const [depositMethod, setDepositMethod] = useState('paystack'); // 'paystack' | 'paybill'
```

`depositAmt`, `busy`, `err`, `depositResults` stay as-is.

`openDeposit()` resets `depositMethod` to `'paystack'` and `depositAmt` to `String(MIN_DEPOSIT)`.

### Layout (top → bottom inside the `<dialog>`)

1. **`<TxHeader asDialog title="Deposit" …>`** — unchanged.
2. **Subtitle row** — `<div>Choose payment method</div>` with the muted small style.
3. **Tile grid** — 2 columns, gap 10, padding 16 horizontal:
   - **Paystack tile**: card icon (existing inline SVG used for the momo phone glyph can be swapped to a credit-card glyph), title `Paystack`, subtitle `Card, bank & mobile money`.
   - **Paybill tile**: receipt/building icon, green accent strip on the left (matching the screenshot's emphasized tile), title `Paybill`, subtitle `Mobile money`.
   - Selected: 1px solid `var(--accent)` border + faint accent tint background. Unselected: 1px solid `var(--line)` + `var(--surface)`. Hit area is the full tile.
4. **Account phone row** — full-width pill card, phone icon left, masked phone string right. Mask rule: keep first 7 chars (incl. `+233 ` and first 2 digits of the local number), replace the next 4 digits with `****`, keep last 3 (e.g. `+233 55****888`). If `account.phone` is missing, fall back to email (no masking) or the literal `Account phone` placeholder.
5. **Balance row** — right-aligned, single line: `Balance (GHS) ¢ {formatAmt(balance)}`.
6. **Amount card** — exact reuse of current markup: label `Amount (GHS)` + hint `min. 300.00`, borderless `<input type="number">` bound to `depositAmt`.
7. **Preset grid** — 5 buttons in a row, equal columns:
   - Labels: `300`, `500`, `2,000`, `5,000`, `10,000`.
   - Click handler: `setDepositAmt(String(n))` (sets, not bumps).
   - Active visual cue: if the typed amount === preset, lightly highlight that tile (not required for v1, nice-to-have).
8. **Conditional tail:**
   - `depositMethod === 'paystack'`:
     - Error line (if `err`).
     - Gold gradient "Top Up Now" button — `disabled` unless `MIN_DEPOSIT <= amount <= MAX_DEPOSIT && !busy`.
     - Submit calls `submitDeposit` which calls `apiDeposit(amt, 'paystack')`.
     - The existing rule list (`Maximum per transaction…`, `Minimum per transaction…`, `Deposit is free…`, `Withdraw to registered MoMo…`) renders below the button.
   - `depositMethod === 'paybill'`:
     - `<PaybillInstructions paybillId="222000" accountRef={account?.phone || account?.email || ''} context="deposit" />`.
     - **No** "Top Up Now" button (paybill is paid via USSD on the user's phone — the modal is informational only).
     - No rule list (PaybillInstructions has its own footer note).

### Phone masking helper

```js
function maskPhone(s) {
  const str = String(s || '');
  if (str.length < 10) return str;
  return str.slice(0, 7) + '****' + str.slice(-3);
}
```

Placed inline near `formatAmt` at the top of `AccountProvider.jsx`.

### Submit handler

Only the **Paystack** branch is wrapped in a `<form onSubmit={submitDeposit}>`. The **Paybill** branch renders `<PaybillInstructions>` outside any form so that pressing Enter in any input it owns (e.g. the future search/help inputs inside it) never accidentally triggers a deposit submission. For Paystack the current `submitDeposit` is reused verbatim with the method string changed to `'paystack'`:

```js
const data = await apiDeposit(amt, 'paystack');
```

Concretely, the JSX structure becomes:

```jsx
{depositMethod === 'paystack' ? (
  <form onSubmit={submitDeposit}>
    {/* account row, balance row, amount card, presets, submit, rules */}
  </form>
) : (
  <div>
    {/* account row, balance row, amount card (read-only? — see note), presets,
        then <PaybillInstructions … /> */}
  </div>
)}
```

**Amount input under Paybill:** the user can still type an amount and tap a preset — the value seeds the on-phone USSD step ("Enter the amount and confirm with your PIN") in the instructions panel below. The input stays editable; it just doesn't submit anywhere.

## Backend change

**None required.** The current Zod schema in [server/src/routes/wallet.js:31-34](../../../server/src/routes/wallet.js) already accepts any method string up to 40 chars (`method: z.string().trim().max(40).optional()`), so `'paystack'` and `'paybill'` flow through without modification. Tightening to a `z.enum(['paystack', 'paybill'])` was considered but rejected:

- No other clients emit deposit methods, so a strict enum gains nothing now.
- Existing in-flight or historical deposits in the tx store carry `'momo'`, `'vodafone'`, `'airteltigo'`, or `'card'`. The admin Deposits queue renders the stored method string verbatim — a stricter request schema doesn't affect those. But if a stale client were ever to retry an old momo deposit, an enum would 400. Permissive is safer.

The admin Deposits queue and the `Deposits.jsx` admin page already display whatever method string is stored, so the new `'paystack'` value renders correctly with no admin-side change.

## CSS additions

In [client/src/styles/app.css](../../../client/src/styles/app.css):

```css
.dep-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  color: var(--text);
  transition: background 120ms ease, border-color 120ms ease;
}
.dep-tile[aria-selected="true"] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}
.dep-tile-title { font-weight: 800; font-size: 14px; }
.dep-tile-sub   { font-size: 12px; color: var(--text-dim); line-height: 1.3; }
.dep-tile-icon  { width: 36px; height: 36px; border-radius: 8px;
                  display: inline-flex; align-items: center; justify-content: center; }
.dep-method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 12px; }
.dep-preset-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 16px; }
.dep-preset { padding: 12px 0; background: var(--surface); border: 1px solid var(--line);
              border-radius: 8px; color: var(--accent); font-weight: 700; font-size: 13px; cursor: pointer; }
```

Removes nothing — the existing `.tx-tabs` rules can stay (or be cleaned up separately).

## Error handling

- Amount below `MIN_DEPOSIT` or above `MAX_DEPOSIT` → existing `err` line ("Minimum deposit is GHS 300.", etc.).
- Network failure on submit → existing `e.message || 'Deposit failed.'` line.
- Switching methods clears `err` (small UX fix — current code already implicitly does this on remount; we'll set `err: ''` in the tile click handler explicitly).

## Accessibility

- Tile grid is a `role="radiogroup"`; each tile is a `<button type="button" role="radio" aria-checked={selected}>`.
- Preset buttons are `<button type="button" aria-label={'Set amount to GHS ' + n}>`.
- Amount input keeps its `id="dep-amt"` and visible label association.
- Dialog still uses native `<dialog>` semantics (no change).
- Focus order: header back → first tile → … → amount input → first preset → submit (paystack only).

## Testing checklist (manual)

1. Sign in as a normal user.
2. Open deposit (any of the existing entry points: Home action grid, Profile menu, etc.).
3. Modal opens with **Paystack tile selected**, amount = `300`, focus on the amount input.
4. Tap Paybill → tile selection flips, the bottom of the modal switches to `PaybillInstructions` (paybill `222000`, account ref = phone). No "Top Up Now" button visible.
5. Tap Paystack → tile flips back, "Top Up Now" reappears, amount input retains the typed value.
6. Tap each preset (`300`, `500`, `2,000`, `5,000`, `10,000`) → amount input updates to that exact value.
7. Type `100` → "Top Up Now" disabled + error "Minimum deposit is GHS 300.".
8. Type `60000` → button disabled (max-cap path).
9. Type `500` → button enabled; submit → toast "Deposit of GHS 500.00 via Paystack submitted for admin approval.".
10. Admin approves in `/admin/deposits` → user sees `DepositResultModal` "Deposit approved" + balance updates.
11. Resize to mobile width (375 px) → tile grid stays 2-up, presets stay 5-up, no overflow.
12. Dark mode token check — tiles use surface/line/accent tokens, no hardcoded colors.

## Implementation order

1. **CSS additions** (app.css).
2. **State + helper refactor** (AccountProvider.jsx — `maskPhone`, drop tab state, swap method state).
3. **Dialog body rewrite** (AccountProvider.jsx — tiles, account row, balance row, amount, presets, conditional tail).
4. **Manual test pass** against the checklist above (browser preview).
5. **Commit + push.**

Each step gets its own commit so the diff stays reviewable.

## Risk register

| Risk | Mitigation |
|---|---|
| Existing pending deposits in DB have `method: 'momo' / 'card'` — admin UI must still render them. | Admin UI renders the stored method string verbatim. No risk. |
| User confusion: "Paystack" tile but no real Paystack popup — admin still has to approve. | Toast message ("submitted for admin approval") already conveys this. Follow-up task: real Paystack integration. |
| Phone masking exposes too few / too many digits if a user's phone format is non-standard. | Helper returns the raw string when length `< 10`. Edge case is visible but not broken. |
| Backend enum widen + frontend rewrite must ship together; either alone would break the deposit. | Single PR, single commit, deployed atomically. |

## Follow-ups (not in this spec)

- Real Paystack inline integration (`@paystack/inline-js` + verify webhook + credit-on-success). Tracked separately.
- Animated tile-selection transitions.
- Active-preset highlighting when the typed amount matches one.
- Telemetry on which method users pick.
