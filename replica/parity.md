# Parity report: Practice Invest vs Alinea Invest (updated 2026-11-03, after the stock-figures and inbox build)

**Verdict: still not shippable by the skill's rule**: one must-have is only partly built (the Allie chat answers from scripts until you add an Anthropic key). No open S1 or S2 bug, and the feature score is above the 80% bar.

## What these numbers mean (read this first)
- **The "original" side is public information only**: App Store listing, Alinea's site, press and reviews (`recon.md`). I never used the app, and no reference screenshots exist. "Parity" means "does what Alinea publicly says it does", not "matches how it behaves in depth".
- **The score leaves out 6 things that cannot be cloned**: real brokerage and custody (DriveWealth), SEC-registered adviser services, bank linking, identity checks, crypto custody, and Alinea's brand, copy and portfolios. They are most of what makes the original a real-money product. The clone is a practice tool with simulated money and fictional investments, on purpose.
- **Ratings are mine** (`features.csv`, "clone" column), backed by the browser and unit tests in `test-plan.md`.

## Scores
| measure | result |
|---|---|
| Feature parity (before this build) | 84.6% |
| Feature parity (now) | see below |
| Layout parity | **not run**: `replica/screens/` is empty, so there is nothing to compare against |
| Overall | not computed (needs layout) |

**Feature parity: 90%** (23 scored features: 17 done, 5 partial, 1 not built; 6 excluded as not clonable).  
**Must-haves: 10 of 11 done.** Not shippable until every must-have is done.

| area | score | features |
|---|---|---|
| web | 0% | 1 |
| social | 50% | 1 |
| assets | 50% | 1 |
| ai | 70% | 2 |
| research | 80% | 2 |
| account | 93% | 4 |
| onboarding | 100% | 1 |
| portfolio | 100% | 6 |
| playlists | 100% | 3 |
| planning | 100% | 2 |

| # | priority | feature | status | note |
|---|---|---|---|---|
| 1 | must | AI Allie chat (educational) | partial | scripted answers behind the real interface; no LLM yet | BACKEND: Claude API mode written and mock-tested (needs your key); scripted fallback always works |
| 2 | should | Daily Briefing (news for holdings) | partial | now delivered every market day to the inbox; still built from simulated price moves, not real news (real news about fictional investments is not possible) |
| 3 | could | Marketing landing page + savings calculator | no | not started |
| 4 | could | Crypto access (simulated prices) | partial | two simulated coins list + playlist; no buy sheet of its own |
| 5 | could | Membership + billing screen | partial | info card in Settings; no billing by design |
| 6 | could | Share playlists / community feed | partial | own playlists only; no sharing or feed (private clone) |

Excluded as not clonable (6): real brokerage and custody, adviser services, bank linking, crypto custody, identity checks and tax documents, Alinea's brand and proprietary content.

## What changed since the last report
- **Stock profiles: partial to done.** Key figures from the simulated history, plain-words drivers, and "Ask Allie about this".
- **Notifications: partial to done.** An in-app inbox with a bell and unread count; contribution made, rebalanced, daily briefing and weekly recap, each switchable (the recap has none). No push or email.
- **Allie recaps: partial to done.** Weekly automatic recap in the inbox plus on demand in the chat. The wording is scripted, not AI-written.
- **Daily briefing: still partial.** Now delivered every market day, but built from simulated price moves. Real headlines about fictional investments do not exist, so a news feed would not help; this row will stay partial unless the app moves to real investments.

## Layout diff
Not run, for the same reason as before. Put screenshots of your own Alinea account in `replica/screens/` (390x844, named by screen ID). The clone's captures are in `replica/clone-screens/` (S01-S14, S16, S18, plus the new S20 inbox, S06 figures and S05 bell).

## Behaviour differences
| flow | Alinea (public information) | clone | fix or keep |
|---|---|---|---|
| Money | real, held at DriveWealth | simulated; practice cash | keep, by design |
| Cost | about $120 a year | none | keep (private) |
| Set up investing | "about 30 seconds" | 11 clicks from the welcome screen to Home, no typing needed | not measured in the original; keep |
| Looking back | not described | a "practice start" replays your plan on past prices | keep: an addition for learning |
| Allie | AI assistant | scripted answers; the Claude-backed mode is written and mock-tested but needs your key | **fix**: add the key and verify with a real call |
| News | real headlines | notes from simulated price moves, labelled as such | keep (no real news exists for fictional investments) |
| Alerts | not described | in-app inbox, no push or email | keep for now |
| Crypto | real, held at Zero Hash | two simulated coins | keep |
| Playlists | shareable, with a community | private only | keep (private) |
| Input safety, double-clicks, two tabs, keyboard use | not known | tested (17 bugs fixed); zero WCAG A/AA violations on 17 screens, light and dark | keep |

## What is left, and what it needs
1. **Allie on the real Claude API** (the one open must-have). Needs your `ANTHROPIC_API_KEY`; the code and its tests exist. Then one real call to verify.
2. **A real Supabase sign-in check.** Not a feature row, but the backend is only verified up to your accounts (`backend.md`).
3. **Real market data and news**: only meaningful if the app moves to real investments, which is a different product (it would need a licensed broker partner to trade them).
4. Could-haves: marketing landing page (not built), membership screen, shared playlists and a fuller crypto screen (all partial and low value for a private app).

Next step: add your Anthropic key and I verify Allie against the real API, then re-score. Or `/replica-entrepreneur`, which would work from the original's public reviews only.
