# Test plan (replica-test, 2026-11-03)

Target: the clone only (`clone/`, local mode unless stated). The original app was never contacted. Selectors use roles and labels. Case IDs are used in the spec titles (`e2e/specs/`). A = automated, M = manual, B = backend mode (needs Supabase, partly covered by `e2e/backend.cjs`), - = not applicable.

Every automated test also fails on: any console error, uncaught page error, any 5xx response.

## F01 Onboard and invest (S01-S05)
| ID | case | expect | how |
|---|---|---|---|
| F01-H1 | answer all 5 steps, pick amount, start 6 months ago | home shows value > 0, 5 holdings, one plan | A |
| F01-H2 | reload in the middle of the questionnaire | same step, answers kept | A |
| F01-H3 | Back inside the questionnaire | previous answers still selected | A |
| F01-E1 | press Continue with nothing chosen (steps 1-3) | error text, no advance | A |
| F01-E2 | birth year 1929, 1930, 2008, 2009, "abc", "19 95" | only 1930 to (this year - 18) accepted | A |
| F01-E3 | name with emoji, accents, 40 chars, markup | shown literally, saved, no layout break | A |
| F01-E4 | amount "0", "0.99", "100000.01", "1e3", Arabic digits, "12.345", "-5", "", spaces | each rejected with a message | A |
| F01-E5 | amount "1", "100000", "$1,000.50" | each accepted | A |
| F01-E6 | double-click "Start investing" | exactly one plan | A |
| F01-E7 | open /onboarding/portfolio and /onboarding/fund with no answers | sent back to the questionnaire | A |
| F01-E8 | already set up, open /onboarding, /onboarding/portfolio, /onboarding/fund | sent to Home; no second plan | A |
| F01-E9 | start Today / 6 months / 1 year, weekly, monthly day 28 | expected number of deposits, none on weekends or holidays | A |
| F01-E10 | browser in Tokyo vs Panama around midnight | "as of" date follows the profile time zone | A |
| F01-N1 | browser storage blocked | app works in memory, no crash | A |
| F01-N2 | stored data is corrupt JSON | fresh start, no crash | A |
| F01-N3 | stored data is an old or partial shape | no crash, no data loss of valid parts | A |

## F02 Browse and join a playlist (S07, S08)
| F02-H1 | search, open, invest $40 | holdings and activity updated, Invested badge | A |
| F02-E1 | invest amount "", 0, -1, abc, 100001 | rejected with a message | A |
| F02-E2 | double-click Invest | one investment | A |
| F02-E3 | open a playlist before setting up | sent to welcome | A |
| F02-E4 | unknown playlist id | "gone" state, not a crash | A |
| F02-E5 | invest on a Saturday | uses Friday's price, dated Friday | A |
| F02-E6 | crypto playlist | works, home shows the coin warning | A |

## F03 Build a playlist (S09)
| F03-H1 | create with Spread evenly, edit, delete | appears under Mine, edits kept, delete removes | A |
| F03-E1 | save with empty name | message, nothing saved | A |
| F03-E2 | weights not 100% | Save disabled, error banner | A |
| F03-E3 | negative, zero, text, 1000 as a weight | cannot be saved as a valid playlist | A |
| F03-E4 | same investment added twice | not offered twice | A |
| F03-E5 | 60-character name with no spaces | no horizontal overflow on list, detail, builder | A |
| F03-E6 | markup in name, theme, description | shown as text, nothing executes | A |
| F03-E7 | three equal weights | Spread evenly totals exactly 100% | A |
| F03-E8 | delete a playlist you already invested in | home and activity unaffected | A |

## F04 Ask Allie (S11)
| F04-H1 | ask a question, get a reply with the disclaimer | A |
| F04-E1 | empty and whitespace question | Send disabled / nothing sent | A |
| F04-E2 | double-click Send | one question, one reply | A |
| F04-E3 | markup in the question | shown as text | A |
| F04-E4 | "should I buy X?" | refuses, explains | A |
| F04-E5 | emoji and accents | accepted | A |
| F04-E6 | reload | conversation kept | A |
| F04-E7 | recap with no orders | friendly empty message | A |

## F05 Goals (S10)
| F05-H1 | add a goal, see projection, move the slider | text changes | A |
| F05-E1 | empty name, amount 0, past year, year > +60 | each rejected | A |
| F05-E2 | edit and delete | persisted | A |
| F05-E3 | $0.50 target | rejected or handled, consistent with the server rule ($1 minimum) | A |
| F05-E4 | 60-character name with no spaces | no overflow | A |
| F05-E5 | very large target | formats, no NaN | A |
| F05-E6 | goal next year, and no plan at all | sensible text, no NaN or Infinity | A |

## F06 Morning check (S05, S06, S12, S13, S14)
| F06-H1 | Home to Briefing to a stock and back | pages load with data | A |
| F06-E1 | Briefing, Activity with no holdings | empty states | A |
| F06-E2 | unknown ticker, malformed URL escape | not-found state | A |
| F06-E3 | Activity filters and paging | correct subsets | A |

## F07 Change plan, settings (S05, S16)
| F07-H1 | pause, resume, change amount, add cash | reflected | A |
| F07-E1 | amount "", 0, abc in the sheets | rejected | A |
| F07-E2 | double-click Add cash | added once | A |
| F07-E3 | Escape closes a sheet; focus returns to the opener | A |
| F07-E4 | toggles and time zone persist after reload | A |
| F07-E5 | reset practice account | back to setup, own playlists kept, no leftovers | A |
| F07-E6 | delete all data | welcome screen | A |

## F06 additions (stock figures) and F08 Inbox
| ID | case | how |
|---|---|---|
| F06-E5 | key figures, what drives it, Ask Allie fills the question without sending | A |
| F06-E6 | calm and wild investments are described differently | A |
| F06-E7 | a question handed over in the address is capped at 500 characters and shown as text | A |
| F08-H1 | a plan produces contribution, briefing and recap notices; the bell counts them; rows link to the right screen | A |
| F08-E1 | mark all read clears the count and survives a reload | A |
| F08-E2 | a week later new notices arrive | A |
| F08-E3 | switching notifications off stops those kinds (the weekly recap has no switch) | A |
| F08-E4 | an empty inbox explains itself | A |
| F08-E5 | reloading never duplicates notices; a year-long replay announces only the last week | A |
| X-V1 | short labels and numbers never wrap, every page, 320 and 390 px | A |

## X Cross-cutting
| X-A1 | axe (WCAG 2 A/AA) on 16 screens, light and dark | zero violations | A |
| X-K1 | keyboard only: complete the questionnaire and a sheet; focus trapped in sheet | A |
| X-R1 | 320px and 390px width, every page | no horizontal scroll | A |
| X-S1 | markup payloads in every text field | nothing executes | A (in F01/F03/F04) |
| X-T1 | two tabs open, both change the account | both changes survive | A |
| X-T2 | change in one tab appears in the other | A |
| X-N1 | fonts blocked / slow | layout intact | A |
| X-N2 | reduced motion | no animation | M |
| B-1 | signed out sees only the sign-in screen; API refuses no token; second user sees nothing; delete account | covered by `e2e/backend.cjs` | B (run) |
| B-2 | expired session, offline mid-action, email delivery, token refresh | needs a Supabase project | M, not run |
| X-M1 | real phone (iOS Safari, Android Chrome), screen reader | M, not run |

## Results (2026-11-03)
| layer | run | result |
|---|---|---|
| Playwright e2e (`clone/e2e/specs`; plans F01-F08, X) | first run (79 tests) | 57 passed, 22 failed (11 were real bugs, the rest mistakes in the tests) |
| same, after the new features | final (90 tests) | **90 passed**, 0 failed, 0 flaky |
| Unit + server tests (vitest) | final | 110 passed, 4 skipped without a database (all 114 pass with one) |
| Real Postgres 16 driver tests | final | 4 of 4 passed; migrations 0001 and 0002 applied |
| Browser against real server + Postgres (`e2e/backend.cjs`, B-1) | final | passed (10 checks) |
| Older smoke scripts (`e2e/slice.cjs`, `e2e/screens.cjs`) | final | passed |
| Accessibility (X-A1) | final | 0 WCAG A/AA violations on 17 screens including the inbox, light and dark |

Not run: X-N2 reduced motion, B-2 (expired session, offline, email delivery), X-M1 (real phones, screen reader). See `bugs.md` "To check".

Run it yourself: `cd clone && npm run build && npx playwright test` (uses the browser already installed; `npm test` for the unit tests).
