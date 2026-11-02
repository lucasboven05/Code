# Build log

Date: 2026-11-02 (one session). App lives in `clone/` (Next.js 15, React 19, TypeScript, Tailwind 3). Data layer is **fake on purpose**: `LocalData` in `clone/src/lib/data.ts` keeps everything in the browser and implements the `DataLayer` interface the real backend (`/replica-backend`) will implement, so screens will not change.

| ID | screen | status | what is missing / notes |
|---|---|---|---|
| S01 | Welcome | done | |
| S02 | Goal questionnaire | done | 5 steps, resumable, keyboard-tested |
| S03 | Matched portfolio | done | portfolios are fictional samples; user cannot override the match |
| S04 | Fund + schedule | done | extension: "practice start" replays the plan on past prices (not in the original) |
| S05 | Home / portfolio | done | chart is replayed from the order log |
| S06 | Stock profile | partial | simulated price chart, your holding, about. No real fundamentals, no news list, no Allie summary |
| S07 | Playlists browse | done | |
| S08 | Playlist detail | done | performance is a simulated 3-month index |
| S09 | Playlist builder | done | create, edit, delete; weights must total 100% |
| S10 | Goals and projections | done | rate slider; all labelled hypothetical |
| S11 | Allie | partial | **scripted**, no LLM yet; refuses buy/sell advice; recap is a button, not automatic |
| S12 | Daily briefing | partial | built from simulated price moves, **not news**; clearly labelled |
| S13 | Activity | done | |
| S14 | Crypto | partial | list of two simulated coins; buying goes through the "Crypto curious" playlist |
| S15 | Community feed | not built | private clone: own playlists only, no sharing |
| S16 | Settings | partial | profile, time zone, toggles, reset, delete. No security settings (no accounts yet) |
| S17 | Membership | partial | info card inside Settings; no billing by design |
| S18 | Legal | done | |
| S19 | Marketing landing + calculator | not built | |

**Screens: 11 of 19 done (S01-S05, S07-S10, S13, S18), 6 partial (S06, S11, S12, S14, S16, S17), 2 not built (S15, S19). Must-haves: 9 of 11 done; the two partial must-haves are Stock profiles and Allie chat.**

## Differences from the plan
- **Jobs run when the app opens, not on a server cron.** `runJobs` replays every market day since the last open, so nothing is missed and nothing runs twice (tested). Real cron arrives with the backend.
- **Rebalance trigger is 3 points, not 5.** With weekly contributions the weights almost never drift 5 points, so rebalancing would never visibly fire. Measured before changing it (max drift 2.7 to 5.1 points over 22 months across the five portfolios).
- **No `portfolio_snapshots` table yet.** The home chart replays the order log at each day's price, which gives full history from day one.
- **Prices are simulated** (seeded random walk, same every reload). All instruments are fictional and tickers are prefixed (S-, FX-, X-) so they cannot be mistaken for real ones. `src/lib/prices.ts` is the single file a real market-data provider replaces.

## Harder than it looked
- **Scheduling across time zones and market days.** "Today" depends on the user's time zone, buys only happen on market days, and a monthly date can fall on a weekend or holiday. Handled with a calendar module (NYSE holidays 2025 to 2027, from the trader-alerts skill and the public NYSE calendar) and a run key of contribution + scheduled day. Beyond 2027 only weekends are treated as closed.
- **Rebalancing with fractional shares and cents.** Sells first, then buys with the cash. Value is conserved to within a cent per order (tested).
- **Allie.** A believable assistant needs an LLM and a server-side key. The scripted version covers about eight topics and says so; it is a stand-in, not a finished feature.

## Verification
- `npm test`: 17 unit tests on the engine (weights total 100%, no overspend, one run per scheduled day, holidays/weekends, catch-up, rebalance conserves value, projection closed form, time zones).
- `e2e/slice.cjs` and `e2e/screens.cjs` (Playwright, against `next build` + `next start`): full onboarding, every screen's states and validation, keyboard use of the questionnaire and Escape-closing sheets, reload does not duplicate orders, no horizontal overflow at 390 and 1440 on 14 pages, no console errors.
- `next build` succeeds (18 routes); `tsc --noEmit` clean.
- **Not verified:** layout against the original (no reference screenshots exist), screen-reader behaviour beyond labels and roles, real devices, dark-mode screenshots of the app (tokens are tested in the design sheet only).

## Commits
Screens were built together in three commits (engine, app, docs) rather than one per screen.
