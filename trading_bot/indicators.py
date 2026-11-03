from __future__ import annotations

from typing import Sequence

from .models import Bar


def sma(values: Sequence[float], n: int) -> list[float]:
    """Simple moving average; output[i] aligns with values[i + n - 1]."""
    if n <= 0 or len(values) < n:
        return []
    out, window = [], sum(values[:n])
    out.append(window / n)
    for i in range(n, len(values)):
        window += values[i] - values[i - n]
        out.append(window / n)
    return out


def atr(bars: Sequence[Bar], n: int) -> float | None:
    """Wilder's Average True Range of the latest bar. None if not enough data."""
    if len(bars) < n + 1:
        return None
    trs = []
    for prev, cur in zip(bars, bars[1:]):
        trs.append(max(cur.high - cur.low, abs(cur.high - prev.close), abs(cur.low - prev.close)))
    value = sum(trs[:n]) / n
    for tr in trs[n:]:
        value = (value * (n - 1) + tr) / n
    return value
