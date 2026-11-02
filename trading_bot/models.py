from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

    @property
    def sign(self) -> int:
        return 1 if self is Side.BUY else -1

    @property
    def opposite(self) -> "Side":
        return Side.SELL if self is Side.BUY else Side.BUY


@dataclass(frozen=True)
class Bar:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


@dataclass(frozen=True)
class InstrumentInfo:
    symbol: str
    min_qty: float
    qty_step: float
    max_qty: float
    # Account-currency P&L for a 1.0 price move on 1 unit of quantity.
    # IB stock: 1. IB future: multiplier. MT5: tick_value / tick_size per lot.
    value_per_price_unit: float


@dataclass(frozen=True)
class Position:
    symbol: str
    qty: float  # signed: >0 long, <0 short
    avg_price: float
    unrealized_pnl: float = 0.0

    @property
    def side(self) -> Side:
        return Side.BUY if self.qty > 0 else Side.SELL
