"""Deliberately simple SMA-cross strategy. It is a placeholder: the point of this
project is the execution + risk layer. Swap in your own `signal()` as needed."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .config import StrategyConfig
from .indicators import sma
from .models import Bar


@dataclass(frozen=True)
class Signal:
    direction: int      # +1 fast above slow, -1 fast below slow, 0 unknown
    fresh_cross: bool   # the cross happened on the latest bar
    bar_time: object = None


class SmaCross:
    def __init__(self, cfg: StrategyConfig):
        self.cfg = cfg

    @property
    def min_bars(self) -> int:
        return self.cfg.slow + 2

    def signal(self, bars: Sequence[Bar]) -> Signal:
        closes = [b.close for b in bars]
        if len(closes) < self.min_bars:
            return Signal(0, False)
        fast, slow = sma(closes, self.cfg.fast), sma(closes, self.cfg.slow)
        # align on the last two bars
        f1, f0 = fast[-1], fast[-2]
        s1, s0 = slow[-1], slow[-2]
        direction = 1 if f1 > s1 else -1 if f1 < s1 else 0
        prev = 1 if f0 > s0 else -1 if f0 < s0 else 0
        return Signal(direction, direction != 0 and direction != prev, bars[-1].time)
