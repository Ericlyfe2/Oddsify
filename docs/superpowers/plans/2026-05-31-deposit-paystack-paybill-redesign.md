# Deposit Modal Redesign — Paystack + Paybill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the deposit `<dialog>` body in `AccountProvider.jsx` so users see a 2-tile picker (Paystack default, Paybill), an account-phone row, a balance row, an amount card, and a 5-button preset grid (`300 / 500 / 2,000 / 5,000 / 10,000`). UI-only — no real Paystack gateway; submission stays on the existing pending-admin-approval flow.

**Architecture:** Single-file frontend rewrite. Replace the tab strip + three method bodies (Mobile Money / Paybill / Card) with a tile-picker + conditional tail. Paystack path keeps the existing `<form onSubmit={submitDeposit}>`; Paybill path renders `<PaybillInstructions>` outside any form. Drop `depositTab` state, rebind `depositMethod` to `'paystack' | 'paybill'`. Add a `maskPhone()` helper. Add a focused CSS block in `app.css` for the new layout (`.dep-tile`, `.dep-method-grid`, `.dep-account-row`, `.dep-balance-row`, `.dep-amount-card`, `.dep-preset-grid`, `.dep-submit`, etc.). No backend change — the Zod `depositSchema.method` is already a permissive `z.string().trim().max(40).optional()`.

**Tech Stack:** React 18, Vite 5, native `<dialog>`, CSS variables (existing token system — `--surface`, `--line`, `--accent`, `--text`, `--text-dim`, `--accent-warm`, `--accent-hot`, `--bg`). No new dependencies.

**Verification:** No frontend test framework in this repo. Each task ends with a manual browser-preview verification using the `preview_*` tool family (server already exposes the deposit modal via `openDeposit()` on `AccountCtx`, reachable from Profile → Deposit, Home action grid, etc.).

**Spec:** [docs/superpowers/specs/2026-05-31-deposit-paystack-paybill-redesign.md](../specs/2026-05-31-deposit-paystack-paybill-redesign.md).

---

## File structure

| File | Responsibility | Change type |
|---|---|---|
| `client/src/styles/app.css` | Visual tokens for tiles, account row, balance row, amount card, presets, submit, rules, paybill body. Replaces the stale `.deposit-dlg form` overflow rule with one on `.deposit-dlg .deposit-body`. | Modify (append + delete one rule) |
| `client/src/providers/AccountProvider.jsx` | Deposit state simplification (`depositMethod: 'paystack' \| 'paybill'`, drop `depositTab`). Add `maskPhone()` helper. Rewrite dialog body. | Modify |

No files created. No files deleted. `PaybillInstructions.jsx`, `TxHeader.jsx`, `DepositResultModal.jsx`, `wallet.js` (server) are untouched.

---

## Task 1: CSS additions for the new deposit layout

**Files:**
- Modify: `client/src/styles/app.css` (append a new section near the existing `.deposit-dlg` rules around line 1405; delete the now-stale `.deposit-dlg form { … overflow-y: auto … }` rule)

- [ ] **Step 1: Append the new CSS block**

Open `client/src/styles/app.css` and append the following block at the **end** of the file (so it overrides the older `.deposit-dlg form` rule for the new structure — we'll still delete that older rule in Step 2):

```css
/* === Deposit modal v2 — Paystack + Paybill tiles, preset grid ===
   Used by the rewritten dialog body in AccountProvider.jsx.
   Scroll container is .deposit-body, not the inner <form>. */
.deposit-dlg .deposit-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg);
}
.dep-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-soft);
  margin-bottom: 10px;
}
.dep-method-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.dep-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  color: var(--text);
  font: inherit;
  transition: background 120ms ease, border-color 120ms ease;
}
.dep-tile:hover { border-color: var(--line-strong); }
.dep-tile[aria-selected="true"] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}
.dep-tile-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dep-tile-title { font-weight: 800; font-size: 14px; }
.dep-tile-sub   { font-size: 12px; color: var(--text-dim); line-height: 1.3; }

.dep-account-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-bottom: 6px;
}
.dep-account-icon {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--surface-2); color: var(--text-soft);
  display: flex; align-items: center; justify-content: center;
}
.dep-account-text { flex: 1; font-weight: 700; font-size: 14px; color: var(--text); }
.dep-account-label { font-size: 12px; color: var(--text-dim); }

.dep-balance-row {
  text-align: right;
  font-size: 13px;
  color: var(--text-soft);
  margin: 8px 0 12px;
}
.dep-balance-amt { color: var(--text); font-weight: 700; }

.dep-amount-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
}
.dep-amount-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.dep-amount-head label {
  font-size: 15px; font-weight: 700; color: var(--text);
}
.dep-amount-hint {
  font-size: 13px; color: var(--text-dim);
}
.dep-amount-card input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 24px;
  font-weight: 800;
  outline: none;
  padding: 0;
  font-variant-numeric: tabular-nums;
}

.dep-preset-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 16px;
}
.dep-preset {
  padding: 12px 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.dep-preset:hover { border-color: var(--accent); }

.dep-err {
  margin-bottom: 12px;
  color: var(--accent-hot);
  font-size: 13px;
  font-weight: 600;
}
.dep-submit {
  width: 100%;
  padding: 14px 0;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-warm));
  color: #000;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 18px;
}
.dep-submit:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
  cursor: not-allowed;
}
.dep-rules {
  padding-left: 18px;
  margin: 0;
  font-size: 13px;
  color: var(--text-soft);
  line-height: 1.7;
}
.dep-paybill-body { display: flex; flex-direction: column; gap: 12px; }
```

- [ ] **Step 2: Delete the stale `.deposit-dlg form` overflow rule**

Find this block in `client/src/styles/app.css` (around line 1431):

```css
.deposit-dlg form {
  flex: 1 1 auto;
  overflow-y: auto;
  ...
}
```

Delete the entire rule. The new scroll container is `.deposit-dlg .deposit-body` (added in Step 1). The Paystack branch's `<form>` is now a child of `.deposit-body`, so it should not be the flex/scroll container itself.

If the rule has additional properties beyond `flex` and `overflow-y`, remove the whole selector — none of the descendants need any of it.

- [ ] **Step 3: Verify CSS file still parses**

Run from the repo root:

```bash
npx vite build --mode development --logLevel error 2>&1 | tail -20
```

Expected: build succeeds with no `Unexpected token` / `Unknown at-rule` errors. If you see CSS parser errors referencing the new block, re-check braces and the `color-mix(...)` syntax (note: requires modern browsers — falls back gracefully because the fallback `border-color` is sufficient).

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/app.css
git commit -m "feat(deposit): add CSS for new tile-based deposit layout

Tiles, account row, balance row, amount card, preset grid, submit,
rules, paybill body. New scroll container is .deposit-dlg .deposit-body;
delete the stale .deposit-dlg form overflow rule."
```

---

## Task 2: State + helper refactor in AccountProvider

**Files:**
- Modify: `client/src/providers/AccountProvider.jsx` (lines 32-50 area for state + helper, lines 281-285 for `openDeposit`, lines 292-314 for `submitDeposit`)

This task does **not** yet rewrite the dialog body. It only updates state and helpers so Task 3 can plug in cleanly.

- [ ] **Step 1: Add the `maskPhone` helper**

Find `formatAmt` at line 32:

```js
function formatAmt(n) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

Add **directly below it** (still above `AppProviders`):

```js
// Mask a Ghana-style number for display: "+233551234567" → "+233 55****567".
// For non-phone fallbacks (email, short strings) the input is returned as-is.
function maskPhone(s) {
  const str = String(s || '').replace(/\s/g, '');
  if (!str) return 'Account phone';
  if (str.length < 10) return str;
  return `${str.slice(0, 4)} ${str.slice(4, 6)}****${str.slice(-3)}`;
}
```

- [ ] **Step 2: Simplify deposit state**

Find lines 46-48:

```js
  const [depositAmt,  setDepositAmt]   = useState(String(MIN_DEPOSIT));
  const [depositMethod, setDepositMethod] = useState('momo');
  const [depositTab, setDepositTab]   = useState('momo'); // 'momo' | 'paybill' | 'card'
```

Replace with:

```js
  const [depositAmt,  setDepositAmt]   = useState(String(MIN_DEPOSIT));
  const [depositMethod, setDepositMethod] = useState('paystack'); // 'paystack' | 'paybill'
```

(The `depositTab` line is deleted entirely.)

- [ ] **Step 3: Update `openDeposit`**

Find lines 281-285:

```js
  const openDeposit = useCallback(() => {
    if (!account) { toast('Sign in to deposit.'); navigate('/login'); return; }
    setErr(''); setDepositAmt(String(MIN_DEPOSIT)); setDepositMethod('momo');
    depositDlg.current?.showModal();
  }, [account, toast, navigate]);
```

Replace with:

```js
  const openDeposit = useCallback(() => {
    if (!account) { toast('Sign in to deposit.'); navigate('/login'); return; }
    setErr(''); setDepositAmt(String(MIN_DEPOSIT)); setDepositMethod('paystack');
    depositDlg.current?.showModal();
  }, [account, toast, navigate]);
```

- [ ] **Step 4: Update `submitDeposit` toast labels**

Find lines 309-310:

```js
      const labels = { momo: 'MoMo', vodafone: 'Vodafone Cash', airteltigo: 'AirtelTigo Money', card: 'Card' };
      toast(`Deposit of GHS ${formatAmt(amt)} via ${labels[depositMethod] || depositMethod} submitted for admin approval.`, 'info');
```

Replace with:

```js
      const labels = { paystack: 'Paystack', paybill: 'Paybill' };
      toast(`Deposit of GHS ${formatAmt(amt)} via ${labels[depositMethod] || depositMethod} submitted for admin approval.`, 'info');
```

(The `apiDeposit(amt, depositMethod)` call on line 304 stays unchanged — `depositMethod` is now `'paystack'` whenever this submit handler fires, since Paybill has no submit button. The server happily accepts the `'paystack'` string because the Zod schema is permissive.)

- [ ] **Step 5: Confirm no other references to `depositTab` remain**

Run:

```bash
grep -n "depositTab" client/src/providers/AccountProvider.jsx
```

Expected: **no matches**. If anything prints, hunt down the leftover and remove it.

- [ ] **Step 6: Confirm the file still type-checks via build**

Run from repo root:

```bash
npx vite build --mode development --logLevel error 2>&1 | tail -20
```

Expected: build succeeds. The dialog body will still reference `depositTab` at this stage — **build will fail with "depositTab is not defined"** because the JSX in lines 397-513 still uses it. **This is expected** — proceed to Task 3 immediately; this task is intentionally only half a refactor. If you stop here, the modal will be broken. Mark Task 3 in-progress before committing Task 2 if you prefer to avoid an intermediate broken state.

- [ ] **Step 7: Commit (skip if doing Tasks 2 + 3 in one go)**

Optional intermediate commit:

```bash
git add client/src/providers/AccountProvider.jsx
git commit -m "refactor(deposit): simplify state to paystack|paybill and add maskPhone

State-only refactor; dialog body still references depositTab and will
be rewritten in the next commit. Intermediate state — do not deploy."
```

Alternative: skip the commit and go straight to Task 3, then commit Tasks 2 + 3 together.

---

## Task 3: Rewrite the deposit dialog body

**Files:**
- Modify: `client/src/providers/AccountProvider.jsx` (lines 372-518 — the entire `<dialog ref={depositDlg} className="deposit-dlg">` element body)

- [ ] **Step 1: Replace the dialog body**

Find this entire block (lines 372-518):

```jsx
        <dialog ref={depositDlg} className="deposit-dlg">
          {(() => {
            const networks = {
              momo:       { label: 'MTN Mobile Money', short: 'MTN', tag: 'MTN' },
              vodafone:   { label: 'Telecel Cash',     short: 'Telecel', tag: 'TLC' },
              airteltigo: { label: 'AT Money',         short: 'AT',  tag: 'AT'  },
            };
            ...
            // (everything through to the closing </dialog>)
            ...
          })()}
        </dialog>
```

Replace the **entire** `<dialog>...</dialog>` element with:

```jsx
        <dialog ref={depositDlg} className="deposit-dlg">
          {(() => {
            const amtNum = parseFloat(String(depositAmt).replace(/,/g, '')) || 0;
            const canSubmit = amtNum >= MIN_DEPOSIT && amtNum <= MAX_DEPOSIT && !busy;
            const accountPhone = account?.phone || account?.email || '';
            const maskedPhone = maskPhone(accountPhone);
            const closeDlg = () => { try { depositDlg.current?.close(); } catch { /* ignore */ } };
            const selectMethod = (m) => { setErr(''); setDepositMethod(m); };

            return (
              <>
                <TxHeader
                  asDialog
                  title="Deposit"
                  onBack={closeDlg}
                  onForward={() => { closeDlg(); navigate(1); }}
                  onHelp={() => { closeDlg(); navigate('/help'); }}
                  onHome={() => { closeDlg(); navigate('/'); }}
                />

                <div className="deposit-body">
                  <div className="dep-section-label">Choose payment method</div>

                  <div className="dep-method-grid" role="radiogroup" aria-label="Payment method">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={depositMethod === 'paystack'}
                      aria-selected={depositMethod === 'paystack'}
                      className="dep-tile"
                      onClick={() => selectMethod('paystack')}
                    >
                      <div className="dep-tile-icon" style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="6" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <div className="dep-tile-title">Paystack</div>
                      <div className="dep-tile-sub">Card, bank &amp; mobile money</div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={depositMethod === 'paybill'}
                      aria-selected={depositMethod === 'paybill'}
                      className="dep-tile"
                      onClick={() => selectMethod('paybill')}
                    >
                      <div className="dep-tile-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 21h18" />
                          <path d="M5 21V10l7-4 7 4v11" />
                          <path d="M9 21v-6h6v6" />
                        </svg>
                      </div>
                      <div className="dep-tile-title">Paybill</div>
                      <div className="dep-tile-sub">Mobile money</div>
                    </button>
                  </div>

                  <div className="dep-account-row">
                    <div className="dep-account-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                    </div>
                    <div className="dep-account-text">{maskedPhone}</div>
                    <div className="dep-account-label">Account phone</div>
                  </div>

                  <div className="dep-balance-row">
                    Balance (GHS) <span className="dep-balance-amt">¢ {formatAmt(balance)}</span>
                  </div>

                  {depositMethod === 'paystack' ? (
                    <form onSubmit={submitDeposit}>
                      <div className="dep-amount-card">
                        <div className="dep-amount-head">
                          <label htmlFor="dep-amt">Amount (GHS)</label>
                          <span className="dep-amount-hint">min. {MIN_DEPOSIT}.00</span>
                        </div>
                        <input
                          id="dep-amt"
                          type="number"
                          min={MIN_DEPOSIT}
                          max={MAX_DEPOSIT}
                          step="1"
                          inputMode="decimal"
                          value={depositAmt}
                          onChange={(e) => setDepositAmt(e.target.value)}
                          placeholder={`min. ${MIN_DEPOSIT}`}
                          autoFocus
                        />
                      </div>

                      <div className="dep-preset-grid">
                        {[300, 500, 2000, 5000, 10000].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="dep-preset"
                            onClick={() => setDepositAmt(String(n))}
                            aria-label={`Set amount to GHS ${n}`}
                          >
                            {n.toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>

                      {err && <div className="dep-err">{err}</div>}

                      <button type="submit" disabled={!canSubmit} className="dep-submit">
                        {busy ? 'Processing…' : 'Top Up Now'}
                      </button>

                      <ol className="dep-rules">
                        <li>Maximum per transaction is GHS {MAX_DEPOSIT.toLocaleString('en-US')}.00</li>
                        <li>Minimum per transaction is {MIN_DEPOSIT}.00</li>
                        <li>Deposit is free, no transaction fees.</li>
                        <li>Your balance can only be withdrawn to the mobile number that&rsquo;s registered with.</li>
                      </ol>
                    </form>
                  ) : (
                    <div className="dep-paybill-body">
                      <div className="dep-amount-card">
                        <div className="dep-amount-head">
                          <label htmlFor="dep-amt-pb">Amount (GHS)</label>
                          <span className="dep-amount-hint">min. {MIN_DEPOSIT}.00</span>
                        </div>
                        <input
                          id="dep-amt-pb"
                          type="number"
                          min={MIN_DEPOSIT}
                          max={MAX_DEPOSIT}
                          step="1"
                          inputMode="decimal"
                          value={depositAmt}
                          onChange={(e) => setDepositAmt(e.target.value)}
                          placeholder={`min. ${MIN_DEPOSIT}`}
                        />
                      </div>

                      <div className="dep-preset-grid">
                        {[300, 500, 2000, 5000, 10000].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="dep-preset"
                            onClick={() => setDepositAmt(String(n))}
                            aria-label={`Set amount to GHS ${n}`}
                          >
                            {n.toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>

                      <PaybillInstructions
                        paybillId="222000"
                        accountRef={account?.phone || account?.email || ''}
                        context="deposit"
                      />
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </dialog>
```

- [ ] **Step 2: Verify the build now succeeds**

Run from repo root:

```bash
npx vite build --mode development --logLevel error 2>&1 | tail -20
```

Expected: build succeeds with no errors. The leftover `depositTab` reference from Task 2 should now be gone (the `<dialog>` no longer references it).

- [ ] **Step 3: Quick visual smoke check — start the dev preview**

From the repo root, start the dev preview (server + client together):

```bash
npm run dev
```

(Or use `preview_start` with the project's vite dev command.)

Wait for both the API (`http://127.0.0.1:4000`) and the client (`http://localhost:5173`) to be ready.

- [ ] **Step 4: Reach the deposit modal**

In the preview browser:

1. `preview_eval`: `window.location.href = 'http://localhost:5173/login'`
2. Sign in with a seeded user (or use the email/Google flow if SMTP/Google are wired locally; otherwise check the server console for the OTP).
3. `preview_eval`: `window.location.href = 'http://localhost:5173/profile'`
4. `preview_click` the "Deposit" action card.

Alternative entry point: Home page action grid → Deposit.

- [ ] **Step 5: Confirm tile picker default + switching**

`preview_snapshot` and confirm:

- "Deposit" header is visible.
- "Choose payment method" label is visible.
- **Two** tiles (Paystack, Paybill). The Paystack tile shows `aria-checked="true"`.
- Account-phone row shows a masked phone (e.g. `+233 55****567` for a phone like `+233551234567`).
- Balance row right-aligned: `Balance (GHS) ¢ 0.00` (or current balance).
- Amount card shows `Amount (GHS)` + `min. 300.00`, input value `300`.
- Preset grid: 5 buttons labelled `300 / 500 / 2,000 / 5,000 / 10,000`.
- "Top Up Now" button visible.

`preview_click` the Paybill tile. `preview_snapshot` and confirm:

- Paybill tile is now `aria-checked="true"`, Paystack is `false`.
- The body below the balance row now contains the `PaybillInstructions` component (network chips for MTN/Telecel/AirtelTigo, paybill ID `222000`, Pay ID = the user's phone, step-by-step instructions).
- The "Top Up Now" button is **gone**.
- The amount input + presets are still present (so the user can prepare the amount before keying it into USSD).

`preview_click` the Paystack tile again. `preview_snapshot` and confirm the form layout returns.

- [ ] **Step 6: Confirm presets set the amount (not bump)**

With Paystack selected:

1. `preview_fill` the amount input with `750`.
2. `preview_click` the `300` preset.
3. `preview_inspect` the amount input. Expected value: `300` (not `1050`).
4. `preview_click` the `5,000` preset.
5. `preview_inspect`. Expected value: `5000`.

- [ ] **Step 7: Confirm min-amount validation**

1. `preview_fill` the amount input with `100`.
2. `preview_inspect` the submit button. Expected: `disabled` attribute present.
3. `preview_fill` the amount input with `500`.
4. `preview_inspect`. Expected: `disabled` absent.

- [ ] **Step 8: Confirm a successful submission round-trip**

1. `preview_fill` the amount input with `500`.
2. `preview_click` "Top Up Now".
3. `preview_console_logs` and confirm no React errors.
4. Confirm a toast appears: `Deposit of GHS 500.00 via Paystack submitted for admin approval.`
5. `preview_network` — confirm `POST /api/wallet/deposit` returned `200 OK`, request body `{ "amount": 500, "method": "paystack" }`.
6. The dialog closes.

- [ ] **Step 9: Confirm the admin queue sees the deposit**

In a separate preview tab / second browser:

1. Log in as `admin@oddsify.gh` / `Admin@12345` (or whichever the seed produced).
2. Navigate to `/admin/deposits`.
3. Confirm the new pending deposit row shows method = `paystack` (or whichever column renders the method string).

- [ ] **Step 10: Screenshot for the PR**

`preview_screenshot` of the deposit modal with the Paystack tile selected. Save it for the PR description.

- [ ] **Step 11: Commit**

```bash
git add client/src/providers/AccountProvider.jsx
git commit -m "feat(deposit): redesign modal as Paystack + Paybill tile picker

Drop Mobile Money tab and MTN/Telecel/AirtelTigo network carousel,
drop Card tab. New layout: 2-tile picker (Paystack default), account
phone row with masked number, balance row, amount card, 5-button
preset grid (300/500/2,000/5,000/10,000 — sets, not bumps), Paystack
form with Top Up Now / Paybill body with PaybillInstructions.

UI-only: submission still goes through the existing pending
admin-approval flow. No backend change — Zod method enum is
already permissive."
```

---

## Task 4: Final manual regression sweep

**Files:** none modified — pure verification.

- [ ] **Step 1: Confirm existing entry points still open the modal**

The modal is opened by `openDeposit()` exposed on `AccountCtx`. Confirm each of the following triggers it:

1. **ProfilePage action grid** → tap "Deposit" → modal opens.
2. **Home action grid (if present)** → tap "Deposit" → modal opens.
3. **Bottom nav `+` / Wallet** (whatever your shipping entry-points are) → modal opens.

For each, `preview_snapshot` and confirm: tiles render, Paystack default selected, focus is on the amount input.

- [ ] **Step 2: Confirm deposit-approval socket round-trip still works**

While the user-side preview is on the deposit modal closed (after Task 3 Step 8), have the admin tab approve the new deposit. Confirm:

1. Toast `Deposit of GHS 500.00 via Paystack submitted for admin approval.` is already gone.
2. New toast appears: `Deposit approved! GHS 500.00 credited.`
3. `DepositResultModal` opens with `✓ Deposit approved` / `GHS 500.00 has been credited to your wallet.`
4. Balance ticker updates.
5. `OK` closes the modal.

Then have the admin reject a second deposit and confirm the rejected path renders the `✕` modal with the reason field.

- [ ] **Step 3: Light theme check (if light mode is reachable)**

`preview_eval`: `document.documentElement.dataset.theme = 'light'` (or however the app toggles themes — check the existing theme toggle).

Reopen the deposit modal. Confirm:

- Tile borders are visible against the lighter `--surface`.
- The Paybill tile's green accent reads OK against the new background.
- Amount input text contrasts properly against the input card.

Switch back to dark.

- [ ] **Step 4: Mobile viewport check**

`preview_resize` to 375×812 (iPhone X size). Reopen the deposit modal. Confirm:

- 2-up tile grid still fits without horizontal overflow.
- 5-up preset grid does not wrap — preset labels (`10,000` is the longest at 6 chars) fit within 5 equal columns at this width.
- Amount input is the full card width.
- Account-phone row's three children fit on a single line.

- [ ] **Step 5: No regressions in the broader app**

Quick spot check (these should all still work — the only file we changed is `AccountProvider.jsx`, which renders the dialog at the bottom but doesn't affect any other route):

- `/sports` loads.
- `/wallet` (transactions list) loads.
- `/admin` dashboard loads after admin login.
- Sign-out still works.

If any of those break, the change in Task 2 (state simplification) is the most likely culprit — `git diff feat/admin-user-dm -- client/src/providers/AccountProvider.jsx` and re-check that no other consumer of context reads `depositTab` or the old `depositMethod` values.

- [ ] **Step 6: No additional commit needed**

This task is pure verification — no code changes. If a regression is found, fix it inline and amend the previous commit (or add a follow-up commit).

---

## Task 5: Push and (optionally) open a PR

**Files:** none.

- [ ] **Step 1: Push**

```bash
git push -u origin feat/admin-user-dm
```

(The branch already tracks origin — `-u` is harmless.)

- [ ] **Step 2: Open a PR (optional — confirm with user first before running)**

If the user asks for a PR:

```bash
gh pr create --title "feat(deposit): redesign modal as Paystack + Paybill tile picker" --body "$(cat <<'EOF'
## Summary
- Replaces the Mobile Money / Paybill / Card tab strip with a 2-tile picker (Paystack default, Paybill).
- New layout matches the supplied reference: account-phone row, balance row, amount card, 5-button preset grid (300 / 500 / 2,000 / 5,000 / 10,000 — *set*, not bump).
- Drops the MTN / Telecel / AirtelTigo network carousel and the Card-coming-soon placeholder.
- UI-only: submission still routes through the existing pending-admin-approval flow. Backend (Zod schema) needs no change — `method` is already a permissive string.

## Spec
- [docs/superpowers/specs/2026-05-31-deposit-paystack-paybill-redesign.md](docs/superpowers/specs/2026-05-31-deposit-paystack-paybill-redesign.md)

## Test plan
- [x] Modal opens from Profile / Home / Wallet entry points.
- [x] Paystack tile selected by default.
- [x] Tile picker toggles cleanly; Paybill body swaps in `PaybillInstructions`.
- [x] Preset buttons replace the amount value.
- [x] Min-amount validation gates the submit button.
- [x] Submission sends `method: "paystack"` and the admin queue renders it.
- [x] `deposit:approved` / `deposit:rejected` socket events still produce the result modal.
- [x] 375×812 viewport — no overflow.
- [x] Light theme renders correctly.

## Screenshots
<!-- attach the Step-10 screenshot here -->
EOF
)"
```

- [ ] **Step 3: Report back to the user**

Print the commit SHAs and the PR URL (if created).

---

## Self-review checklist (done)

- **Spec coverage:** Every section of the spec maps to a step here:
  - Layout sections 1-8 → Task 3 Step 1.
  - State removals → Task 2 Steps 2-3.
  - Phone-masking helper → Task 2 Step 1.
  - Submit handler change → Task 2 Step 4.
  - Backend "no change" → no task (correctly).
  - CSS additions → Task 1 Step 1.
  - Accessibility (radiogroup roles, preset aria-labels) → Task 3 Step 1.
  - Testing checklist → Task 3 Steps 4-9 + Task 4.
- **Placeholder scan:** No "TBD", "TODO", "implement later", or under-specified steps. Every code step shows the complete code.
- **Type / name consistency:** `depositMethod`, `setDepositMethod`, `maskPhone`, `selectMethod`, `canSubmit`, `amtNum`, `maskedPhone` — all defined where used. `MIN_DEPOSIT` / `MAX_DEPOSIT` reused from existing constants. `apiDeposit` / `submitDeposit` / `formatAmt` reused from existing code.
- **CSS / JSX class-name consistency:** Every class used in the JSX (`dep-tile`, `dep-tile-icon`, `dep-tile-title`, `dep-tile-sub`, `dep-method-grid`, `dep-account-row`, `dep-account-icon`, `dep-account-text`, `dep-account-label`, `dep-balance-row`, `dep-balance-amt`, `dep-amount-card`, `dep-amount-head`, `dep-amount-hint`, `dep-preset-grid`, `dep-preset`, `dep-err`, `dep-submit`, `dep-rules`, `dep-paybill-body`, `deposit-body`) is defined in the CSS block.
- **Existing component contract:** `<PaybillInstructions paybillId accountRef context />` props verified against [client/src/components/PaybillInstructions.jsx](../../../client/src/components/PaybillInstructions.jsx).
