"""Hard risk rules. Nothing here talks to a broker, so it is fully unit-testable.

Three layers:
  1. Position sizing from volatility (ATR stop) and a per-trade risk budget.
  2. Daily loss limit: breach => flatten and no new trades until the next trading day.
  3. Kill switch: a KILL file. If it exists the bot flattens and refuses to trade.
     Create it by hand (`python -m trading_bot kill`) or the bot creates it itself on
     repeated errors. Only a human removes it (`python -m trading_bot unkill`).
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import RiskConfig
from .models import InstrumentInfo


def size_position(
    equity: float,
    entry: float,
    atr_value: float,
    info: InstrumentInfo,
    cfg: RiskConfig,
) -> float:
    """Quantity such that hitting the ATR stop loses ~risk_per_trade_pct of equity.

    Always rounds DOWN to the instrument's step, never up, so the risk budget is
    never exceeded. Returns 0 if even the minimum size would breach it.
    """
    if equity <= 0 or entry <= 0 or atr_value <= 0 or info.value_per_price_unit <= 0:
        return 0.0
    stop_distance = cfg.atr_stop_mult * atr_value
    risk_money = equity * cfg.risk_per_trade_pct / 100.0
    qty = risk_money / (stop_distance * info.value_per_price_unit)

    max_notional = equity * cfg.max_position_notional_pct / 100.0
    qty = min(qty, max_notional / (entry * info.value_per_price_unit), info.max_qty)

    step = info.qty_step
    qty = math.floor(qty / step + 1e-9) * step
    if qty < info.min_qty:
        return 0.0
    return round(qty, 8)


def stop_price(entry: float, atr_value: float, is_long: bool, cfg: RiskConfig) -> float:
    dist = cfg.atr_stop_mult * atr_value
    return entry - dist if is_long else entry + dist


@dataclass
class RiskState:
    day: str = ""
    start_equity: float = 0.0
    daily_halt: bool = False
    halt_reason: str = ""


class RiskManager:
    def __init__(self, cfg: RiskConfig, now=None):
        self.cfg = cfg
        self._now = now or (lambda: datetime.now(ZoneInfo(cfg.timezone)))
        self.state_path = Path(cfg.state_file)
        self.kill_path = Path(cfg.kill_file)
        self.state = self._load()

    # ---- persistence (survives restarts so a crash can't reset the daily limit)
    def _load(self) -> RiskState:
        try:
            return RiskState(**json.loads(self.state_path.read_text()))
        except (OSError, ValueError, TypeError):
            return RiskState()

    def _save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(asdict(self.state), indent=2))
        tmp.replace(self.state_path)

    # ---- daily loss limit
    def today(self) -> str:
        return self._now().date().isoformat()

    def roll_day(self, equity: float) -> None:
        """Record start-of-day equity on first call each trading day."""
        if self.state.day != self.today():
            self.state = RiskState(day=self.today(), start_equity=equity)
            self._save()

    def daily_loss(self, equity: float) -> float:
        return max(0.0, self.state.start_equity - equity)

    def daily_limit(self) -> float:
        limits = [self.state.start_equity * self.cfg.max_daily_loss_pct / 100.0]
        if self.cfg.max_daily_loss_abs > 0:
            limits.append(self.cfg.max_daily_loss_abs)
        return min(limits)

    def daily_loss_breached(self, equity: float) -> bool:
        return self.state.start_equity > 0 and self.daily_loss(equity) >= self.daily_limit()

    def halt_for_day(self, reason: str) -> None:
        self.state.daily_halt = True
        self.state.halt_reason = reason
        self._save()

    @property
    def halted_today(self) -> bool:
        return self.state.daily_halt

    # ---- kill switch
    def kill_reason(self) -> str | None:
        if self.kill_path.exists():
            text = self.kill_path.read_text().strip()
            return text or "kill file present"
        return None

    def trip_kill_switch(self, reason: str) -> None:
        self.kill_path.parent.mkdir(parents=True, exist_ok=True)
        self.kill_path.write_text(f"{self._now().isoformat()} {reason}\n")

    def clear_kill_switch(self) -> None:
        self.kill_path.unlink(missing_ok=True)

    # ---- entry gate
    def may_open(self, equity: float, open_positions: int) -> tuple[bool, str]:
        if self.kill_reason():
            return False, "kill switch engaged"
        if self.state.daily_halt:
            return False, f"daily halt: {self.state.halt_reason}"
        if self.daily_loss_breached(equity):
            return False, "daily loss limit reached"
        if open_positions >= self.cfg.max_open_positions:
            return False, "max open positions reached"
        return True, "ok"
