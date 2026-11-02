# Component specs (original design; tokens in tokens.json)

Rules for all: real semantic elements, visible `:focus-visible` (2px ring in `accent`, 2px offset), 44px minimum touch target, respects `prefers-reduced-motion` (durations drop to 0), never colour alone to show state (always icon or text too), numbers use tabular figures. Icons: Lucide (MIT) in the app; the preview sheet uses plain shapes.

**Button**
  variants  primary, secondary, ghost, danger
  sizes     sm 36px, md 44px, lg 52px (full width on phone forms)
  states    default, hover, active, focus-visible, disabled, loading (spinner replaces icon, label stays for screen readers, aria-busy)
  tokens    primary bg accent / text on-accent; secondary bg surface-2 / text; radius md; font sm 600
  a11y      real `<button>`; disabled uses `disabled`, not just opacity
  used on   S01 S02 S03 S04 S08 S09 S17

**TextField / AmountInput**
  variants  text, amount (large figure, currency prefix, numeric keypad via inputmode=decimal)
  states    default, focus (ring), filled, error (danger border + message with icon), disabled, read-only
  tokens    border border-input, bg surface, radius md, text md
  a11y      visible `<label>`, error linked with aria-describedby, aria-invalid
  used on   S04 S09 S10 S16

**ChoiceCard** (questionnaire answers, risk level)
  states    default, hover, selected (accent-soft bg, accent border, check icon), focus, disabled
  a11y      radio group semantics (one answer) or checkbox group (many), arrow-key navigation
  used on   S02

**Stepper / ProgressBar** (questionnaire)
  shows "Step n of N" as text plus a bar; back button always present; progress is saved (resume)
  used on   S02

**Slider** (horizon years, risk, assumed return)
  states    default, focus, dragging, disabled; value shown as text beside it; step keys with arrows
  used on   S02 S10

**FrequencyPicker** (once, weekly, every two weeks, monthly) - segmented control, radio semantics. used on S04

**AllocationDonut**
  segments use chart-1..6 plus a text legend with % (colour is never the only cue); centre shows total. Tap a segment or row for detail.
  used on   S03 S05 S08

**LineChart** (portfolio, stock price)
  range tabs (1W, 1M, 3M, 1Y, All), tap/drag to read a point (value + date label), gain/loss summary in text, accent line, faint grid, endpoint dot. Empty: "No history yet" state. Loading: skeleton. Labelled "delayed prices" where relevant.
  used on   S05 S06 S08 S10

**HoldingRow** - ticker + name left, value + day change right (success/danger text with arrow icon), whole row is a link. used on S05

**PlaylistCard** - theme name, short description, up to 3 ticker chips, "n holdings", chevron. States default, pressed, invested badge. used on S07

**WeightEditor** (playlist builder) - ticker row, numeric percent field, remove button; footer shows running total and an error banner until total = 100%. used on S09

**NewsRow** (Daily Briefing) - headline (2 lines max), source and time, ticker chip. used on S05 S06 S12

**ChatBubble / PromptChip / Composer** (Allie)
  bubbles: user right (accent-soft), assistant left (surface-2); assistant replies stream with `aria-live=polite`; chips are buttons that fill the composer; composer disables while sending; permanent "Educational only, not advice" line.
  used on   S11

**Banner** (info, warning, error, success) - icon + text, role=status or alert; the "Hypothetical / educational" disclaimer is a warning banner. used on S03 S10 S11 S18

**Toast** - bottom, 4s, role=status, one at a time, dismissible. used everywhere

**BottomTabBar** - 4 tabs (Home, Playlists, Goals, Allie), icon + label, current tab uses accent and `aria-current=page`; height 64px + safe area. used on S05 S07 S10 S11

**BottomSheet** - drag handle, scrim, focus trap, Esc/back closes, returns focus. used on S04 S14 S17

**EmptyState** - icon, one-line title, one sentence of help, one action. Every list has one. used on S05 S07 S12 S13 S15

**Skeleton** - shape-matched grey blocks, shimmer only if motion is allowed. used on all data screens

**Spinner** - 20px ring, `role=progressbar`-free decorative inside a labelled button; page-level uses aria-busy on the region.

**AppHeader** - 56px, title (display font), optional back/profile action, sticky, respects top safe area.

Layout: single column, content max 480px centred, 16px gutters, 8/12/16/24 vertical rhythm, bottom padding clears the tab bar plus safe area.
