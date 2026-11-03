# Trading bot (Interactive Brokers + MetaTrader 5, paper/demo only by default)

Places orders on its own through the official APIs (IB TWS API via `ib_async`, MT5 via the
`MetaTrader5` package) under hard risk rules. Strategy is a placeholder SMA cross; the value is
the execution + risk layer, which is strategy-independent.

## Risk rules (`trading_bot/risk.py`)
| Rule | Behaviour |
|---|---|
| **Volatility sizing** | stop = `atr_stop_mult` × ATR; qty = equity × `risk_per_trade_pct` ÷ (stop distance × value per price unit). Rounded **down** to the lot/share step; skipped if even the minimum size is too risky. Capped by `max_position_notional_pct`. |
| **Broker-side stop** | Every entry carries a stop at the broker, so you're protected if the bot dies. |
| **Max daily loss** | Equity vs start-of-day (realised + unrealised). Breach ⇒ cancel orders, flatten, no trading until next day. Persisted in `state/`, so a restart can't reset it. |
| **Kill switch** | If a `KILL` file exists the bot flattens and refuses to trade. `python -m trading_bot kill` creates it; it is also created automatically after `max_consecutive_errors` failed cycles. Only `unkill` (a human) clears it. |
| **Paper/demo guard** | IB: refuses non-paper ports (7497/4002) and non-`DU…` accounts. MT5: refuses non-DEMO accounts. Overridable only with `allow_live = true`. |

## Using your MT5 demo account
MT5's Python API is **Windows-only** and drives your installed, logged-in terminal.
1. Install MT5, log in to the demo account, enable *Tools → Options → Expert Advisors → Allow algorithmic trading*.
2. `pip install -r requirements.txt`, `cp config.example.toml config.toml`; set `broker = "mt5"`, `[mt5] login/server`, and your symbols.
3. `set MT5_PASSWORD=...` (read from the environment, never stored in the file).
4. `python -m trading_bot run --dry-run --once` → check the logged decisions, then `python -m trading_bot run`.

## Using IB paper
Run TWS or IB Gateway logged in to the paper account (API enabled, port 7497 / 4002), set `broker = "ib"`, then the same commands.

## Commands
`run [--once] [--dry-run]`, `status`, `kill`, `unkill` (all take `-c config.toml`). Tests: `pytest`.

## Caveats
- Not tested against live IB/MT5 here (no terminal in this sandbox): unit tests cover sizing, daily limit, kill switch, restart persistence and the live-account guards using an in-memory broker. **Run `--dry-run` first on your demo account.**
- IB forex sizing assumes the quote currency ≈ account currency; MT5 uses the server's tick value, which is exact.
- Last, possibly unfinished, bar is used for signals; entries only on a fresh cross, once per bar.
- Past performance of any strategy, including this placeholder one, is not implied. This is software, not financial advice.
