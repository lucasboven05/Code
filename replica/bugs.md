# Bugs (replica-test, 2026-11-03)

Only reproduced bugs are listed. "Found by" is the failing test before the fix. Severity: S1 data loss or security, S2 feature broken or data wrong with no workaround, S3 broken with a workaround or visibly wrong, S4 cosmetic.

## Fixed

### BUG-01 (S4) No favicon: every page load logs a 404 in the console
- Found by: every spec (console-error guard), F01-N2.
- Steps: open any page, read the browser console. Expected: no errors. Actual: `GET /favicon.ico 404`.
- Fix: original icon at `clone/src/app/icon.svg`.

### BUG-02 (S2) Double-clicking "Start investing" creates two identical plans, so every period invests twice
- Found by: F01-E6.
- Steps: finish the questionnaire, double-click "Start investing". Expected: one plan. Actual: `contributions` holds two plans with the same schedule; both run on every due day.
- Cause: a `busy` state variable does not stop two clicks that fire before the next render; nothing on the data side refused a second plan.
- Fix: `useLatch` (ignores a second submit while one is running) on every submit that changes data (setup, add cash, change amount, invest, goals, Allie, questionnaire steps) **and** `Service.completeOnboarding` now refuses to run when a plan already exists. Regression: `tests/regressions.test.ts` BUG-02, e2e F01-E6.

### BUG-03 (S2) A set-up user can walk back into the setup screens and create a second plan
- Found by: F01-E8.
- Steps: finish setup, open `/onboarding/fund` (browser Back, or type it), choose an amount, Start investing. Expected: sent Home. Actual: a second plan is added and the practice start date is overwritten.
- Fix: all three setup screens redirect set-up users Home; the data layer refuses (see BUG-02).

### BUG-04 (S3) "5 0", "1,0,0" and similar are silently read as $50 / $100
- Found by: F01-E4, F02-E1, F07-E1.
- Cause: the amount parser removed every space and comma before checking.
- Fix: strict format: digits with optional correctly placed thousands commas, optional `$`, up to 2 decimals. 17 table-driven cases in `tests/regressions.test.ts`.

### BUG-05 (S3) For users ahead of New York, the app trades on a day that has not started in the market
- Found by: F01-E10 (Tokyo, 05:00 on Nov 3 while New York is still Nov 2 15:00: home said "as of Nov 3" and orders were dated Nov 3).
- Fix: the simulation's "today" is the earlier of the user's date and New York's date. Regression: three cases in `tests/regressions.test.ts`, e2e F01-E10 (Tokyo and Los Angeles).

### BUG-06 (S2) Stored data that is partly missing or the wrong shape leaves the home screen unusable
- Found by: F01-N3 ("missing arrays": Home never rendered; the load threw and nothing caught it).
- Fix: `normalizeState` rebuilds a state from any stored JSON, keeping what is valid and filling the rest; unrecognisable data starts fresh. Regression tests for 6 non-state inputs and partial states.

### BUG-07 (S1) Two browser tabs overwrite each other: money added in one tab is lost
- Found by: X-T1 (tab A adds $10, stale tab B adds $20, stored cash rose by $20, not $30), X-T2 (no sync between tabs).
- Cause: each tab kept its own copy of the account in memory and saved the whole copy.
- Fix: every change first re-reads the stored account; other tabs are notified through the browser `storage` event and refresh.

### BUG-08 (S3) Limits differed between the app and the server
- Found by: F02-E1 ($100,000.01 accepted when investing), F05-E3 (a $0.50 goal accepted locally, but the server needs at least $1.00).
- Effect: with a backend, the same input would fail with a technical message.
- Fix: one rule in the data layer for both: money actions $1.00 to $100,000.00; goals at least $1.00.

### BUG-09 (S3) A quick second tap on a sheet's button falls through to whatever is underneath
- Found by: F02-E2 (double-click "Invest": the second click landed on the Goals tab and navigated away).
- Fix: after a sheet closes, taps are absorbed for 450 ms (`clickShield`); invest now navigates Home before the sheet disappears.

### BUG-10 (S3) The playlist builder accepts negative weights that happen to sum to 100%
- Found by: F03-E3 (-50% + 150% enabled "Save playlist").
- Fix: every row must be a number from 0.01 to 100; otherwise Save is disabled and a message names the problem. Rows are no longer silently dropped.

### BUG-11 (S3) Long unbroken text widens the page
- Found by: F03-E5 (+1058 px of horizontal scroll on the playlists list), F05-E4 (+300 px on Goals).
- Fix: text wraps anywhere (`overflow-wrap`) and flex children can shrink.

### BUG-12 (S3) Single-choice questions have no arrow-key navigation
- Found by: X-K1. The design spec (components.md) required it; every option was a separate Tab stop instead of one radio group.
- Fix: one Tab stop per group, arrow keys move and select, for both the question cards and the segmented controls.

### BUG-13 (S4) "Back" always goes Home, even when you came from the Briefing
- Found by: F06-H1.
- Fix: Back returns to the previous in-app page, otherwise to the section's home. My first fix used `document.referrer`, which client-side navigation never updates, and the test caught that it still failed; it now counts in-app page views (`src/lib/nav.ts`).

### BUG-14 (S3) An error shown after you press a sheet's button is hidden behind the sheet
- Found by: F07-E1 ($100,000.01 in "Add practice cash" showed nothing).
- Cause: out-of-range amounts were only checked deep in the data layer and reported as a toast, which sat under the sheet's dark overlay.
- Fix: all money fields validate with one function (`parseMoney`) and show the message next to the field; toasts now sit above overlays.

### BUG-15 (S3) The questionnaire's progress bar has no accessible name
- Found by: X-A1 (axe rule `aria-progressbar-name`, serious, light and dark).
- Fix: labelled "Setup progress", with "Step n of 5" as its value text. After this, axe reports zero WCAG A/AA violations on all 16 screens in both colour schemes.

## Open
None. No open S1 or S2.

## Counts
15 bugs found and fixed: S1 x1 (BUG-07), S2 x3 (BUG-02, 03, 06), S3 x9 (BUG-04, 05, 08, 09, 10, 11, 12, 14, 15), S4 x2 (BUG-01, 13).
Every fix has a test that failed before it: the e2e spec in `clone/e2e/specs/` and, where the logic is in the data layer, a unit test in `clone/tests/regressions.test.ts`.

## To check (seen, not reproduced as a defect, or needs a person)
- A malformed URL escape such as `/stock/%E0%A4%A` is answered by Next itself with a plain HTTP 400 page, not the app's "not found" screen. Harmless, but a different look.
- After "Continue" on a questionnaire step, keyboard focus stays on the same button (now relabelled) and the step change is announced only through the "Step n of 5" live text. A screen-reader pass on a real device should confirm that is enough.
- Reduced-motion behaviour, a real phone (iOS Safari, Android Chrome) and a real screen reader were not tested.
- Backend mode: an expired session, going offline in the middle of an action, and the real email sign-in need a Supabase project and were not run.
- Several of my own tests were wrong at first and were corrected before any product change: an ambiguous option name, a year field that truncates at four characters, a keyboard helper that left Chromium's starting point behind, an axe test that fed itself a half-finished account, and two wrong expected dates. None of those are listed above as bugs.
