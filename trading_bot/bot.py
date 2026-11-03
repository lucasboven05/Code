from __future__ import annotations

import logging
import time

from .brokers.base import Broker
from .config import Config
from .indicators import atr
from .models import Position, Side
from .risk import RiskManager, size_position, stop_price
from .strategy import SmaCross

log = logging.getLogger("bot")


class Bot:
    def __init__(self, broker: Broker, cfg: Config, risk: RiskManager | None = None,
                 strategy: SmaCross | None = None, dry_run: bool = False):
        self.broker, self.cfg = broker, cfg
        self.risk = risk or RiskManager(cfg.risk)
        self.strategy = strategy or SmaCross(cfg.strategy)
        self.dry_run = dry_run
        self.errors = 0
        self._last_entry_bar: dict[str, object] = {}

    # ------------------------------------------------------------------ cycle
    def run_cycle(self) -> None:
        try:
            self._cycle()
            self.errors = 0
        except Exception as exc:  # noqa: BLE001 - any failure counts toward the kill switch
            self.errors += 1
            log.exception("cycle failed (%d/%d): %s", self.errors, self.cfg.risk.max_consecutive_errors, exc)
            if self.errors >= self.cfg.risk.max_consecutive_errors:
                self.risk.trip_kill_switch(f"{self.errors} consecutive errors, last: {exc!r}")
                log.critical("KILL SWITCH TRIPPED after repeated errors")
                self._flatten("errors")

    def _cycle(self) -> None:
        reason = self.risk.kill_reason()
        if reason:
            log.warning("kill switch engaged (%s): flattening, no trading", reason)
            self._flatten("kill switch")
            return

        equity = self.broker.equity()
        self.risk.roll_day(equity)

        if self.risk.daily_loss_breached(equity) and not self.risk.halted_today:
            msg = f"daily loss {self.risk.daily_loss(equity):.2f} >= limit {self.risk.daily_limit():.2f}"
            log.critical("DAILY LOSS LIMIT: %s -> flatten and halt until next trading day", msg)
            self.risk.halt_for_day(msg)
            self._flatten("daily loss limit")
            return
        if self.risk.halted_today:
            log.info("halted for the day: %s", self.risk.state.halt_reason)
            return

        held = {p.symbol: p for p in self.broker.positions()}
        for inst in self.cfg.instruments:
            self._process(inst.symbol, equity, held)

    def _process(self, symbol: str, equity: float, held: dict) -> None:
        scfg, rcfg = self.cfg.strategy, self.cfg.risk
        bars = self.broker.bars(symbol, scfg.timeframe, max(self.strategy.min_bars, rcfg.atr_period + 2) + 5)
        sig = self.strategy.signal(bars)
        pos = held.get(symbol)

        # exit: trend flipped against the open position
        if pos and sig.direction and sig.direction != (1 if pos.qty > 0 else -1):
            log.info("%s: trend flipped, closing %s", symbol, pos.qty)
            if not self.dry_run:
                self.broker.close_position(symbol)
            held.pop(symbol, None)
            pos = None

        if pos or not sig.fresh_cross:
            return
        if sig.direction < 0 and not scfg.allow_short:
            return
        if self._last_entry_bar.get(symbol) == sig.bar_time:
            return  # already traded this bar (e.g. stopped out) - don't re-enter on the same bar

        ok, why = self.risk.may_open(equity, len(held))
        if not ok:
            log.info("%s: entry blocked: %s", symbol, why)
            return
        atr_v = atr(bars, rcfg.atr_period)
        if not atr_v:
            return
        price = self.broker.last_price(symbol)
        qty = size_position(equity, price, atr_v, self.broker.instrument(symbol), rcfg)
        if qty <= 0:
            log.info("%s: size rounds to 0 under risk rules, skipping", symbol)
            return
        side = Side.BUY if sig.direction > 0 else Side.SELL
        stop = stop_price(price, atr_v, side is Side.BUY, rcfg)
        log.info("%s: %s qty=%s @~%.5f stop=%.5f (ATR %.5f, risk %.2f%%)",
                 symbol, side.value, qty, price, stop, atr_v, rcfg.risk_per_trade_pct)
        self._last_entry_bar[symbol] = sig.bar_time
        if not self.dry_run:
            self.broker.open_with_stop(symbol, side, qty, stop)
            held[symbol] = Position(symbol, side.sign * qty, price)  # counts toward max positions

    def _flatten(self, why: str) -> None:
        if self.dry_run:
            log.warning("[dry-run] would flatten (%s)", why)
            return
        try:
            self.broker.flatten_all()
        except Exception:  # noqa: BLE001
            log.exception("FLATTEN FAILED (%s) - close positions manually!", why)

    # ------------------------------------------------------------------- loop
    def run_forever(self) -> None:
        log.info("bot started (%s, dry_run=%s)", self.cfg.broker, self.dry_run)
        try:
            while True:
                self.run_cycle()
                time.sleep(self.cfg.poll_seconds)
        except KeyboardInterrupt:
            log.info("stopped by user (positions keep their broker-side stops)")
