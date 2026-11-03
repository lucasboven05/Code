from datetime import datetime, timedelta, timezone

import pytest

from trading_bot.bot import Bot
from trading_bot.brokers.sim import SimBroker
from trading_bot.config import Config, Instrument, RiskConfig, StrategyConfig
from trading_bot.indicators import atr
from trading_bot.models import Bar, InstrumentInfo
from trading_bot.risk import RiskManager, size_position


def mk_bars(closes, spread=1.0):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [Bar(t0 + timedelta(days=i), c, c + spread, c - spread, c) for i, c in enumerate(closes)]


def cross_up_closes():
    return [100.0] * 60 + [100 - i * 0.2 for i in range(1, 30)] + [94 + i * 1.5 for i in range(1, 31)]


def make(tmp_path, bars, **rk):
    rcfg = RiskConfig(state_file=str(tmp_path / "s.json"), kill_file=str(tmp_path / "KILL"), **rk)
    cfg = Config(broker="ib", risk=rcfg, strategy=StrategyConfig(fast=5, slow=20, timeframe="1d"),
                 instruments=[Instrument("AAA")])
    broker = SimBroker({"AAA": bars})
    return Bot(broker, cfg, RiskManager(rcfg)), broker, rcfg


def test_sizing_risks_budget_and_rounds_down():
    cfg = RiskConfig(risk_per_trade_pct=1.0, atr_stop_mult=2.0, max_position_notional_pct=1000)
    info = InstrumentInfo("X", 1, 1, 10**6, 1.0)
    qty = size_position(100_000, 50.0, 2.0, info, cfg)   # risk 1000 / stop 4 = 250
    assert qty == 250
    # higher volatility -> smaller size
    assert size_position(100_000, 50.0, 4.0, info, cfg) == 125


def test_sizing_mt5_lots_never_exceed_risk():
    cfg = RiskConfig(risk_per_trade_pct=0.5, atr_stop_mult=2.0, max_position_notional_pct=10_000)
    info = InstrumentInfo("EURUSD", 0.01, 0.01, 100, 100_000.0)  # $100k per 1.0 move per lot
    qty = size_position(10_000, 1.10, 0.0050, info, cfg)  # risk $50, stop 0.01 -> $1000/lot -> 0.05 lot
    assert qty == pytest.approx(0.05)
    assert qty * 0.01 * 100_000 <= 50 + 1e-6


def test_sizing_zero_when_min_lot_too_risky():
    cfg = RiskConfig(risk_per_trade_pct=0.1)
    info = InstrumentInfo("X", 1, 1, 100, 1000.0)
    assert size_position(1000, 10, 5, info, cfg) == 0.0


def test_notional_cap():
    cfg = RiskConfig(risk_per_trade_pct=5, max_position_notional_pct=10)
    info = InstrumentInfo("X", 1, 1, 10**6, 1.0)
    assert size_position(100_000, 100.0, 0.5, info, cfg) == 100  # 10% of 100k / 100


def test_atr_constant_range():
    assert atr(mk_bars([10] * 30, spread=1.0), 14) == pytest.approx(2.0)


def test_enters_long_with_stop_on_fresh_cross(tmp_path):
    bars = mk_bars(cross_up_closes())
    # find a cut-off where the cross is fresh on the last bar
    bot, broker, _ = make(tmp_path, bars)
    for end in range(60, len(bars)):
        broker._bars["AAA"] = bars[:end]
        bot.run_cycle()
        if broker.orders:
            break
    kind, sym, side, qty, stop = broker.orders[0]
    assert (kind, sym, side.value) == ("open", "AAA", "BUY")
    assert stop < broker.last_price("AAA") and qty > 0


def test_daily_loss_flattens_and_halts(tmp_path):
    bot, broker, _ = make(tmp_path, mk_bars(cross_up_closes()), max_daily_loss_pct=2.0)
    bot.run_cycle()                       # records start-of-day equity 100k
    broker.pos["AAA"] = __import__("trading_bot.models", fromlist=["Position"]).Position("AAA", 10, 100)
    broker.set_equity(97_000)             # -3% > 2%
    bot.run_cycle()
    assert bot.risk.halted_today and "AAA" not in broker.pos
    n = len(broker.orders)
    broker.set_equity(100_000)            # recovery must NOT re-enable trading the same day
    bot.run_cycle()
    assert len(broker.orders) == n and bot.risk.halted_today


def test_daily_halt_persists_across_restart(tmp_path):
    bot, broker, rcfg = make(tmp_path, mk_bars(cross_up_closes()))
    bot.run_cycle()
    broker.set_equity(90_000)
    bot.run_cycle()
    assert RiskManager(rcfg).halted_today


def test_kill_file_flattens_and_blocks(tmp_path):
    bot, broker, rcfg = make(tmp_path, mk_bars(cross_up_closes()))
    from trading_bot.models import Position
    broker.pos["AAA"] = Position("AAA", 5, 100)
    bot.risk.trip_kill_switch("test")
    bot.run_cycle()
    assert not broker.pos and broker.cancelled >= 1 and all(o[0] == "close" for o in broker.orders)


def test_repeated_errors_trip_kill_switch(tmp_path):
    bot, broker, _ = make(tmp_path, mk_bars(cross_up_closes()), max_consecutive_errors=3)
    broker.fail = True
    for _ in range(3):
        bot.run_cycle()
    assert bot.risk.kill_reason()


def test_dry_run_sends_nothing(tmp_path):
    bars = mk_bars(cross_up_closes())
    bot, broker, _ = make(tmp_path, bars)
    bot.dry_run = True
    for end in range(60, len(bars)):
        broker._bars["AAA"] = bars[:end]
        bot.run_cycle()
    assert broker.orders == []


def test_live_ib_port_refused():
    from trading_bot.brokers.base import LiveAccountRefused
    from trading_bot.brokers.ib import IBBroker
    from trading_bot.config import IBConfig
    with pytest.raises(LiveAccountRefused):
        IBBroker(IBConfig(port=7496), []).connect()
