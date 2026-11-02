from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from ..models import Bar, InstrumentInfo, Position, Side


class BrokerError(RuntimeError):
    pass


class LiveAccountRefused(BrokerError):
    """Raised when connected to a real-money account without explicit opt-in."""


class Broker(ABC):
    @abstractmethod
    def connect(self) -> None:
        """Connect and VERIFY the account is paper/demo (raise LiveAccountRefused otherwise)."""

    @abstractmethod
    def disconnect(self) -> None: ...

    @abstractmethod
    def equity(self) -> float: ...

    @abstractmethod
    def instrument(self, symbol: str) -> InstrumentInfo: ...

    @abstractmethod
    def bars(self, symbol: str, timeframe: str, count: int) -> Sequence[Bar]:
        """Oldest first."""

    @abstractmethod
    def last_price(self, symbol: str) -> float: ...

    @abstractmethod
    def positions(self) -> list[Position]: ...

    @abstractmethod
    def open_with_stop(self, symbol: str, side: Side, qty: float, stop: float) -> str:
        """Market entry with a broker-side protective stop attached, so the stop
        still protects you if this bot crashes or loses connection."""

    @abstractmethod
    def close_position(self, symbol: str) -> None:
        """Close one symbol and remove any resting stop orders for it."""

    @abstractmethod
    def cancel_all_orders(self) -> None: ...

    def flatten_all(self) -> None:
        self.cancel_all_orders()
        for p in self.positions():
            self.close_position(p.symbol)
