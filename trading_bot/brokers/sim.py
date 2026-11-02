"""In-memory broker for tests and offline dry runs."""
from __future__ import annotations

from ..models import Bar, InstrumentInfo, Position, Side
from .base import Broker


class SimBroker(Broker):
    def __init__(self, bars: dict[str, list[Bar]], equity: float = 100_000.0, info: InstrumentInfo | None = None):
        self._bars, self._equity, self._info = bars, equity, info
        self.pos: dict[str, Position] = {}
        self.orders: list[tuple] = []
        self.cancelled = 0
        self.fail = False

    def connect(self): pass
    def disconnect(self): pass

    def equity(self):
        if self.fail:
            raise RuntimeError("boom")
        return self._equity

    def set_equity(self, v): self._equity = v

    def instrument(self, symbol):
        return self._info or InstrumentInfo(symbol, 1, 1, 1_000_000, 1.0)

    def bars(self, symbol, timeframe, count): return self._bars[symbol][-count:]
    def last_price(self, symbol): return self._bars[symbol][-1].close
    def positions(self): return list(self.pos.values())

    def open_with_stop(self, symbol, side, qty, stop):
        self.orders.append(("open", symbol, side, qty, stop))
        self.pos[symbol] = Position(symbol, side.sign * qty, self.last_price(symbol))
        return "1"

    def close_position(self, symbol):
        self.orders.append(("close", symbol))
        self.pos.pop(symbol, None)

    def cancel_all_orders(self): self.cancelled += 1
