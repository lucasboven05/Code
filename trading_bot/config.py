from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass
class RiskConfig:
    risk_per_trade_pct: float = 0.5      # equity risked per trade if the stop is hit
    max_daily_loss_pct: float = 2.0      # realized+unrealized loss vs start-of-day equity
    max_daily_loss_abs: float = 0.0      # optional absolute cap in account currency (0 = off)
    atr_period: int = 14
    atr_stop_mult: float = 2.0           # stop distance = mult * ATR (this is the vol-based sizing)
    max_open_positions: int = 3
    max_position_notional_pct: float = 25.0  # cap on one position's notional vs equity
    max_consecutive_errors: int = 3      # trips the kill switch
    timezone: str = "America/New_York"   # defines the "trading day" for the loss limit
    state_file: str = "state/risk_state.json"
    kill_file: str = "KILL"


@dataclass
class StrategyConfig:
    fast: int = 20
    slow: int = 50
    timeframe: str = "1d"                # 1m 5m 15m 30m 1h 4h 1d
    allow_short: bool = False


@dataclass
class IBConfig:
    host: str = "127.0.0.1"
    port: int = 7497                     # 7497 TWS paper, 4002 IB Gateway paper
    client_id: int = 17
    allow_live: bool = False


@dataclass
class MT5Config:
    login: int = 0
    password_env: str = "MT5_PASSWORD"   # password is read from this env var, never from the file
    server: str = ""
    path: str = ""                       # optional path to terminal64.exe
    deviation: int = 20
    magic: int = 424242
    allow_live: bool = False


@dataclass
class Instrument:
    symbol: str
    sec_type: str = "STK"                # IB only: STK or CASH (forex)
    exchange: str = "SMART"
    currency: str = "USD"


@dataclass
class Config:
    broker: str = "ib"                   # "ib" or "mt5"
    poll_seconds: int = 60
    risk: RiskConfig = field(default_factory=RiskConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    ib: IBConfig = field(default_factory=IBConfig)
    mt5: MT5Config = field(default_factory=MT5Config)
    instruments: list[Instrument] = field(default_factory=list)

    def mt5_password(self) -> str:
        return os.environ.get(self.mt5.password_env, "")


def _fill(cls, data: dict):
    known = {f.name for f in fields(cls)}
    unknown = set(data) - known
    if unknown:
        raise ValueError(f"Unknown {cls.__name__} option(s): {sorted(unknown)}")
    return cls(**data)


def load_config(path: str | Path) -> Config:
    raw = tomllib.loads(Path(path).read_text())
    cfg = Config(
        broker=raw.get("broker", "ib"),
        poll_seconds=raw.get("poll_seconds", 60),
        risk=_fill(RiskConfig, raw.get("risk", {})),
        strategy=_fill(StrategyConfig, raw.get("strategy", {})),
        ib=_fill(IBConfig, raw.get("ib", {})),
        mt5=_fill(MT5Config, raw.get("mt5", {})),
        instruments=[_fill(Instrument, i) for i in raw.get("instruments", [])],
    )
    if cfg.broker not in ("ib", "mt5"):
        raise ValueError("broker must be 'ib' or 'mt5'")
    if not cfg.instruments:
        raise ValueError("Define at least one [[instruments]] entry")
    if cfg.strategy.fast >= cfg.strategy.slow:
        raise ValueError("strategy.fast must be < strategy.slow")
    return cfg
