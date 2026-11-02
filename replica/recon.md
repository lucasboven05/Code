# Recon map: Alinea Invest (private clone, simulated money)

Scope (confirmed by the user): mobile-first **web app (PWA)**, **all** product features, **private, for the user's own practice**. Money is **simulated**. Brokerage, custody, bank linking and adviser registration are not cloned (see section 8).

Evidence key: **seen** = stated on a public page; **inferred** = reasoned from public text, not observed. No screenshots were available (App Store page has image placeholders only, reviewer page returned 403), so every screen below is **inferred from text** until the user shares screenshots of their own account or public screenshots. Nothing here comes from the app's code, network calls or private APIs.

## 1. Sources
| source | URL | gave us |
|---|---|---|
| App Store listing | https://apps.apple.com/app/id1554623825 | name "Alinea: Automated Investing", subtitle, five headline features, 4.7 stars / ~123K ratings, 18+, US residents only, partners (DriveWealth, Plaid, Zero Hash), v12.22.4 |
| Marketing site | https://www.alinea-invest.com | core loop, feature names, $120/yr FAQ, page structure, disclosures |
| TechCrunch, Jan 2024 | https://techcrunch.com/2024/01/24/gen-z-investing-app-alinea-raises-3-4m-plans-to-launch-an-ai-copilot | Playlists = user-built direct indexes, shareable; AI copilot plan; flat subscription |
| Acorns comparison | https://www.acorns.com/learn/investing/acorns-vs-alinea/ | taxable account only, fractional shares, recurring contributions, crypto access, community, what it lacks (competitor page, treat as secondary) |
| Search summaries | Web search, Nov 2026 | AI Allie builds a profile from a questionnaire; themed playlists; Series A reported Apr 2025 |
| User's own account | not provided | (ask the user for screenshots, see section 9) |

Terms note: no account was used. If the user later shares screenshots of their own account, check Alinea's terms first (they may bar building a competing product); the clone is private and non-commercial.

## 2. Screen inventory (inferred)
| ID | screen | how you get there | purpose | key components | states to build |
|---|---|---|---|---|---|
| S01 | Welcome / sign-up | first launch | pitch + start | hero, CTA, legal links | default |
| S02 | Goal questionnaire | after S01 | collect goals, age, risk tolerance | stepper, single-choice cards, sliders | step n of N, validation, resume |
| S03 | Matched portfolio | end of S02 | show model ETF portfolio + why | allocation donut, ETF list, risk label | loading, ready |
| S04 | Fund + schedule | from S03 | set amount and recurring schedule ("about 30 seconds") | amount input, frequency picker, funding source | invalid amount, confirmation |
| S05 | Home / portfolio | tab 1 | balance, performance, holdings | balance header, chart, holdings list, Daily Briefing card | empty (nothing invested), filled, loading |
| S06 | Holding / Stock profile | tap a holding | company page | price chart, stats, news, Allie summary | loading, error |
| S07 | Playlists browse | tab 2 | themed collections | cards, categories, search | empty search |
| S08 | Playlist detail | tap a card | constituents + invest | weights list, performance, Invest CTA | invested / not |
| S09 | Playlist builder | "create" | build own direct index | stock search, weight editor, name/theme, share | validation (weights = 100%) |
| S10 | Goals & projections | tab 3 | yearly goals, "Investing Potential" | goal cards, projection chart, assumptions | hypothetical disclaimer |
| S11 | Allie (AI chat) | tab 4 | ask questions, recaps | chat thread, suggested prompts, recap cards | loading, error, disclaimer |
| S12 | Daily Briefing | card on S05 | news relevant to holdings | news list, source/time | empty (no news) |
| S13 | Activity / history | from S05 | trades, contributions, rebalances | list, filters | empty |
| S14 | Crypto | from S05 or S07 | crypto access | asset list, buy sheet | disabled-by-region |
| S15 | Community feed | from S07 | see/share playlists and ideas | feed, like/follow | empty |
| S16 | Account & settings | profile icon | profile, plan, notifications, security, legal | list rows, toggles | default |
| S17 | Membership / billing | from S16 | $120/yr plan | plan card, renewal date | trial, active, cancelled |
| S18 | Legal & disclosures | footer / S16 | disclosures, privacy | text pages | default |
| S19 | Marketing landing (web) | alinea-invest.com | acquire users | hero, features, savings calculator, security, FAQ, testimonials | default |

Seen vs inferred: S03, S05, S07, S10, S11, S12 map to features named on the App Store listing; S19's section order is from the marketing page; the rest are standard for this kind of app and **inferred**.

## 3. User flows
- **F01 Onboard and invest:** S01 > S02 > S03 > S04 > S05. Edge: user abandons mid-questionnaire (resume), amount below minimum, invalid schedule. Happy path ~5 screens, aim for under 2 minutes ("about 30 seconds" for funding step).
- **F02 Browse and join a playlist:** S07 > S08 > Invest > S05. Edge: playlist weights change, already invested.
- **F03 Build a playlist:** S07 > S09 > save > share (S15). Edge: weights not 100%, duplicate ticker.
- **F04 Ask Allie:** S11 > prompt > answer (educational, not advice banner). Edge: no data, rate limit.
- **F05 Check goals:** S10 > edit goal > projection updates. Edge: unrealistic target.
- **F06 Morning check:** S05 > S12 > S06. 
- **F07 Change plan or schedule:** S16 > S17 or S04.

## 4. Components
Buttons (primary, secondary, destructive), stepper, choice card, slider, amount input with keypad, frequency picker, allocation donut, line chart with range tabs, holdings row, playlist card, weight editor, news row, chat bubble + suggested-prompt chips, recap card, toast, bottom tab bar, bottom sheet, disclaimer banner, empty state, skeleton loader.

## 5. Inferred data model
| entity | fields | evidence | confidence |
|---|---|---|---|
| User | id, name, birthdate/age, created_at | age/goals feed Allie | med |
| Profile | user_id, goals[], risk_tolerance, horizon_years, income_band | "answer questions about goals and risk tolerance" | high |
| ModelPortfolio | id, name, risk_level, allocations[{ticker, weight}] | "matched to a model portfolio of ETFs" | high |
| Account (simulated) | user_id, cash, portfolio_id, created_at | taxable brokerage only | high |
| Contribution | id, amount, frequency, next_run, status | "set an amount and schedule" | high |
| Holding | account_id, ticker, qty (fractional), cost_basis | fractional shares | high |
| Order/Activity | id, type (buy/sell/contribution/rebalance), ticker, qty, price, ts | rebalancing, auto-invest | med |
| Playlist | id, owner_id, name, theme, weights[], is_public | user-built direct indexes, shareable | high |
| Goal | id, user_id, target_amount, target_year | "Yearly Goals" | med |
| Briefing | date, items[{ticker, headline, source, url}] | "Daily Briefing" | med |
| ChatMessage | id, user_id, role, text, ts | Allie | high |
| Membership | user_id, plan, status, renews_at | $120/yr | high |
| Instrument | ticker, name, type (stock/ETF/crypto), last_price | stock profiles | high |

## 6. Feature matrix
See `features.csv` (columns: feature, area, priority, original, clone, notes). `clone` starts at `no`.

## 7. Components needing external data (for the clone)
Prices and company data need a market-data source; news needs a news source; Allie needs an LLM. All are replaceable with the user's own keys. See architect step.

## 8. What cannot be cloned
- **Real brokerage and custody** (DriveWealth, FINRA/SIPC): regulated, needs a licensed partner. Clone uses **simulated cash and fills**.
- **SEC-registered adviser status / model portfolio construction as advice:** regulated. Clone ships clearly labelled **sample** model portfolios, educational only.
- **Bank linking (Plaid):** replace with a simulated funding source (or manual entry).
- **Crypto custody (Zero Hash):** simulated prices only.
- **Alinea's investment team, proprietary portfolios and playlist data, brand, copy, logos:** original content must be our own.
- **The user network (community, other people's playlists):** the clone's feed would hold only the user's own playlists.
- **Identity checks (KYC), US-residency verification, tax documents:** skipped.

## 9. Size and hard parts
- Counts: 19 screens, 7 flows, 13 entities.
- Size: **M** for the simulated app with a phone-first PWA (a few weeks of part-time work); **XL** if real trading were included, so it is excluded.
- Hardest parts: (1) a market-data feed for prices/charts/stock profiles, (2) the simulated portfolio engine (fractional fills, scheduled contributions, rebalancing, performance math), (3) Allie: an LLM assistant that stays educational and grounded in the user's holdings.
- Open question for the user: **screenshots** of their own Alinea account (if they have one) would let us confirm layouts before design; otherwise design proceeds from the text above.

Next step: `/replica-architect`.
