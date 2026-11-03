"""MetaTrader 5 via the official `MetaTrader5` Python package.
Windows only. The MT5 terminal must be installed and running; use a DEMO account."""
from __future__ import annotations

from ..config import MT5Config
from ..models import Bar, InstrumentInfo, Position, Side
from .base import Broker, BrokerError, LiveAccountRefused

TF_NAMES = {"1m": "M1", "5m": "M5", "15m": "M15", "30m": "M30", "1h": "H1", "4h": "H4", "1d": "D1"}


class MT5Broker(Broker):
    def __init__(self, cfg: MT5Config, password: str):
        self.cfg = cfg
        self.password = password
        self.mt5 = None

    def connect(self) -> None:
        import MetaTrader5 as mt5

        self.mt5 = mt5
        kwargs = {}
        if self.cfg.path:
            kwargs["path"] = self.cfg.path
        if self.cfg.login:
            kwargs.update(login=self.cfg.login, password=self.password, server=self.cfg.server)
        if not mt5.initialize(**kwargs):
            raise BrokerError(f"MT5 initialize failed: {mt5.last_error()}")
        info = mt5.account_info()
        if info is None:
            raise BrokerError(f"MT5 account_info failed: {mt5.last_error()}")
        if info.trade_mode != mt5.ACCOUNT_TRADE_MODE_DEMO and not self.cfg.allow_live:
            mt5.shutdown()
            raise LiveAccountRefused("MT5 account is not a DEMO account. Refusing to trade.")
        if not info.trade_allowed:
            raise BrokerError("Trading is disabled for this account/terminal (enable Algo Trading).")

    def disconnect(self) -> None:
        if self.mt5:
            self.mt5.shutdown()

    def equity(self) -> float:
        return float(self.mt5.account_info().equity)

    def _info(self, symbol):
        self.mt5.symbol_select(symbol, True)
        si = self.mt5.symbol_info(symbol)
        if si is None:
            raise BrokerError(f"Unknown MT5 symbol {symbol}")
        return si

    def instrument(self, symbol):
        si = self._info(symbol)
        per_unit = si.trade_tick_value / si.trade_tick_size  # account currency per 1.0 price move per lot
        return InstrumentInfo(symbol, si.volume_min, si.volume_step, si.volume_max, per_unit)

    def bars(self, symbol, timeframe, count):
        self._info(symbol)
        tf = getattr(self.mt5, f"TIMEFRAME_{TF_NAMES[timeframe]}")
        rates = self.mt5.copy_rates_from_pos(symbol, tf, 0, count)
        if rates is None:
            raise BrokerError(f"No rates for {symbol}: {self.mt5.last_error()}")
        from datetime import datetime, timezone

        return [Bar(datetime.fromtimestamp(int(r["time"]), timezone.utc), float(r["open"]), float(r["high"]),
                    float(r["low"]), float(r["close"]), float(r["tick_volume"])) for r in rates]

    def last_price(self, symbol):
        t = self.mt5.symbol_info_tick(symbol)
        if t is None:
            raise BrokerError(f"No tick for {symbol}")
        return float((t.bid + t.ask) / 2)

    def positions(self):
        out = []
        for p in self.mt5.positions_get() or []:
            sign = 1 if p.type == self.mt5.POSITION_TYPE_BUY else -1
            out.append(Position(p.symbol, sign * float(p.volume), float(p.price_open), float(p.profit)))
        return out

    def _filling(self, si):
        # bit 1 = FOK allowed, bit 2 = IOC allowed
        if si.filling_mode & 2:
            return self.mt5.ORDER_FILLING_IOC
        if si.filling_mode & 1:
            return self.mt5.ORDER_FILLING_FOK
        return self.mt5.ORDER_FILLING_RETURN

    def _send(self, req):
        res = self.mt5.order_send(req)
        if res is None or res.retcode != self.mt5.TRADE_RETCODE_DONE:
            raise BrokerError(f"MT5 order rejected: {res}")
        return res

    def open_with_stop(self, symbol, side, qty, stop):
        si = self._info(symbol)
        tick = self.mt5.symbol_info_tick(symbol)
        buy = side is Side.BUY
        res = self._send({
            "action": self.mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": float(qty),
            "type": self.mt5.ORDER_TYPE_BUY if buy else self.mt5.ORDER_TYPE_SELL,
            "price": tick.ask if buy else tick.bid,
            "sl": round(stop, si.digits),  # stop lives on the server => survives a bot crash
            "deviation": self.cfg.deviation, "magic": self.cfg.magic, "comment": "tradingbot",
            "type_time": self.mt5.ORDER_TIME_GTC, "type_filling": self._filling(si),
        })
        return str(res.order)

    def close_position(self, symbol):
        si = self._info(symbol)
        for p in self.mt5.positions_get(symbol=symbol) or []:
            tick = self.mt5.symbol_info_tick(symbol)
            was_buy = p.type == self.mt5.POSITION_TYPE_BUY
            self._send({
                "action": self.mt5.TRADE_ACTION_DEAL, "symbol": symbol, "volume": p.volume,
                "type": self.mt5.ORDER_TYPE_SELL if was_buy else self.mt5.ORDER_TYPE_BUY,
                "position": p.ticket, "price": tick.bid if was_buy else tick.ask,
                "deviation": self.cfg.deviation, "magic": self.cfg.magic, "comment": "tradingbot close",
                "type_time": self.mt5.ORDER_TIME_GTC, "type_filling": self._filling(si),
            })

    def cancel_all_orders(self):
        for o in self.mt5.orders_get() or []:
            self._send({"action": self.mt5.TRADE_ACTION_REMOVE, "order": o.ticket})
