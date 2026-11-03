# Parity report: Practice Invest vs Alinea Invest (2026-11-03)

**Verdict: not shippable by the skill's rule** (two must-haves are only partly built). There is no open S1 or S2 bug (`bugs.md`), and the feature score is above the 80% bar, so closing those two must-haves is what stands between this and "shippable".

## What these numbers mean (read this first)
- **The "original" side is public information only**: the App Store listing, Alinea's site, and press and review pages (`recon.md`). I never used the app, and no reference screenshots exist. So "parity" means "does what Alinea publicly says it does", not "matches how it behaves in depth".
- **The score leaves out 6 things that cannot be cloned**: real brokerage and custody (DriveWealth), SEC-registered adviser services, bank linking, identity checks, crypto custody, and Alinea's brand, copy and portfolios. They are most of what makes the original a real-money product. The clone is a practice tool with simulated money and fictional investments, on purpose.
- **Ratings are mine** (`features.csv`, "clone" column), backed by the 79 browser tests and 93 unit and server tests in `test-plan.md`.

## Scores
| measure | result |
|---|---|
| Feature parity | see below |
| Layout parity | **not run**: `replica/screens/` is empty, so there is nothing to compare against. Any number would be invented. |
| Overall | not computed (needs layout) |

**Feature parity: 85%** (23 scored features: 14 done, 8 partial, 1 not built; 6 excluded as not clonable).  
**Must-haves: 9 of 11 done.** Not shippable until every must-have is done.

| area | score | features |
|---|---|---|
| web | 0% | 1 |
| research | 50% | 2 |
| social | 50% | 1 |
| ai | 50% | 2 |
| assets | 50% | 1 |
| account | 86% | 4 |
| onboarding | 100% | 1 |
| portfolio | 100% | 6 |
| playlists | 100% | 3 |
| planning | 100% | 2 |

| # | priority | feature | status | note |
|---|---|---|---|---|
| 1 | must | AI Allie chat (educational) | partial | scripted answers behind the real interface; no LLM yet | BACKEND: Claude API mode written and mock-tested (needs your key); scripted fallback always works |
| 2 | must | Stock profiles | partial | chart, holding, about, 1y range. No real stats or news |
| 3 | should | AI Allie Recaps | partial | on-demand button, scripted; not weekly/automatic |
| 4 | should | Daily Briefing (news for holdings) | partial | built from simulated price moves, NOT real news |
| 5 | could | Marketing landing page + savings calculator | no | not started |
| 6 | could | Crypto access (simulated prices) | partial | two simulated coins list + playlist; no buy sheet of its own |
| 7 | could | Membership + billing screen | partial | info card in Settings; no billing by design |
| 8 | could | Notifications | partial | preferences saved; nothing is delivered |
| 9 | could | Share playlists / community feed | partial | own playlists only; no sharing or feed (private clone) |

Excluded as not clonable (6): real brokerage and custody, adviser services, bank linking, crypto custody, identity checks and tax documents, Alinea's brand and proprietary content.

## Layout diff
Not run. To run it: put screenshots of your own Alinea account in `replica/screens/` named by screen ID (S05.png ...) at 390x844, save the clone's in `replica/clone-screens/` in the same state (there are already captures of S01-S14, S16, S18 from the build), and compare structure. A diff tool is not included in the skill's folder here, so I would write one. The score would check where information sits, not colours, which `replica-brand` changes on purpose.

## Behaviour differences
| flow | Alinea (public information) | clone | fix or keep |
|---|---|---|---|
| Money | real, held at DriveWealth | simulated; practice cash | keep, by design |
| Cost | about $120 a year | none | keep (private) |
| Set up investing | "about 30 seconds" | 11 clicks from the welcome screen to Home, no typing needed (defaults are filled) | not measured in the original; keep |
| Looking back | not described | a "practice start" replays your plan on past prices from 6 or 12 months ago | keep: an addition for learning |
| Allie | AI assistant | scripted answers; the Claude-backed mode is written and mock-tested but needs your key | **fix**: add the key and verify with a real call |
| News | real headlines | notes built from simulated price moves, labelled as such | **fix**: needs a news provider (your choice and key) |
| Crypto | real, held at Zero Hash | two simulated coins | keep |
| Playlists | shareable, with a community | private only | keep (private) |
| Rebalancing | not stated | weekly, when a holding drifts more than 3 points; switchable | keep |
| Input safety, double-clicks, two tabs, keyboard use | not known | tested (15 bugs fixed); zero WCAG A/AA violations on 16 screens, light and dark | keep |

## Top five to build next
1. **Stock profile depth** (must, partial). Add key figures computed from the simulated history (one-year range, typical daily swing, worst fall) and a plain-words "what drives this kind of investment", plus an "Ask Allie about this" button. No keys needed. This closes a must-have.
2. **Allie on the real Claude API** (must, partial). Needs your Anthropic key; the code is written. Then a weekly automatic recap (closes the "recaps" gap too).
3. **A real Supabase sign-in check**. Not a feature row, but the backend is only verified up to your accounts (`backend.md`).
4. **Notifications actually delivered** (could, partial). The preferences exist and nothing is sent. An in-app inbox for "contribution made" and "rebalanced" needs no keys.
5. **Daily briefing from real headlines** (should, partial). Needs your choice of news provider and key (for example Finnhub or Alpha Vantage; check each one's current free-tier limits).

The marketing landing page (could, not built) is last: a private app has no use for it.

Next step: build items 1 and 4 now (no keys), then `/replica-entrepreneur` once you have real users' complaints to learn from. Since this clone is private and has no public users, entrepreneur would work from the original's public reviews only.
