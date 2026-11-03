"""Interactive Brokers via the TWS API (ib_async). Needs TWS or IB Gateway running,
logged in to a PAPER account, with API access enabled."""
from __future__ import annotations

import math

from ..config import IBConfig, Instrument
from ..models import Bar, InstrumentInfo, Position, Side
from .base import Broker, BrokerError, LiveAccountRefused

PAPER_PORTS = {7497, 4002}
BAR_SIZE = {"1m": "1 min", "5m": "5 mins", "15m": "15 mins", "30m": "30 mins",
            "1h": "1 hour", "4h": "4 hours", "1d": "1 day"}
TF_MINUTES = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440}


class IBBroker(Broker):
    def __init__(self, cfg: IBConfig, instruments: list[Instrument]):
        self.cfg = cfg
        self.specs = {i.symbol: i for i in instruments}
        self.ib = None
        self._contracts = {}

    def connect(self) -> None:
        if self.cfg.port not in PAPER_PORTS and not self.cfg.allow_live:
            raise LiveAccountRefused(
                f"Port {self.cfg.port} is not a paper-trading port {sorted(PAPER_PORTS)}. "
                "Set ib.allow_live = true only when you really mean it.")
        from ib_async import IB

        self.ib = IB()
        self.ib.connect(self.cfg.host, self.cfg.port, clientId=self.cfg.client_id, timeout=15)
        accounts = self.ib.managedAccounts()
        # IB paper account ids start with "DU" (or "DF" for financial advisors).
        if not self.cfg.allow_live and not all(a.startswith(("DU", "DF")) for a in accounts):
            self.ib.disconnect()
            raise LiveAccountRefused(f"Account(s) {accounts} do not look like paper accounts (DU...).")

    def disconnect(self) -> None:
        if self.ib and self.ib.isConnected():
            self.ib.disconnect()

    def _contract(self, symbol: str):
        if symbol not in self._contracts:
            from ib_async import Forex, Stock

            spec = self.specs[symbol]
            if spec.sec_type == "STK":
                c = Stock(symbol, spec.exchange, spec.currency)
            elif spec.sec_type == "CASH":
                c = Forex(symbol)
            else:
                raise BrokerError(f"Unsupported sec_type {spec.sec_type}")
            if not self.ib.qualifyContracts(c):
                raise BrokerError(f"IB could not qualify contract for {symbol}")
            self._contracts[symbol] = c
        return self._contracts[symbol]

    def equity(self) -> float:
        for row in self.ib.accountSummary():
            if row.tag == "NetLiquidation":
                return float(row.value)
        raise BrokerError("NetLiquidation not available")

    def instrument(self, symbol: str) -> InstrumentInfo:
        c = self._contract(symbol)
        spec = self.specs[symbol]
        mult = float(c.multiplier) if getattr(c, "multiplier", "") else 1.0
        if spec.sec_type == "CASH":
            # IB forex minimum is 20k+ units; value is in the quote currency
            # (not converted to account currency, so sizing is approximate for non-USD quotes).
            return InstrumentInfo(symbol, 20000, 1, 10_000_000, 1.0)
        return InstrumentInfo(symbol, 1, 1, 1_000_000, mult)

    def bars(self, symbol, timeframe, count):
        c = self._contract(symbol)
        tf_min = TF_MINUTES[timeframe]
        days = math.ceil(count * 1.6) + 5 if tf_min >= 1440 else max(2, math.ceil(count * tf_min / 300) + 2)
        raw = self.ib.reqHistoricalData(
            c, endDateTime="", durationStr=f"{days} D", barSizeSetting=BAR_SIZE[timeframe],
            whatToShow="MIDPOINT" if self.specs[symbol].sec_type == "CASH" else "TRADES",
            useRTH=True, formatDate=1)
        out = [Bar(b.date, b.open, b.high, b.low, b.close, float(b.volume)) for b in raw]
        return out[-count:]

    def last_price(self, symbol):
        c = self._contract(symbol)
        t = self.ib.reqTickers(c)[0]
        px = t.marketPrice()
        if px != px or px <= 0:  # NaN: no live data subscription -> fall back to last bar
            return self.bars(symbol, "1d", 2)[-1].close
        return float(px)

    def positions(self):
        out = []
        for p in self.ib.positions():
            if p.position:
                out.append(Position(p.contract.symbol, float(p.position), float(p.avgCost)))
        return out

    def open_with_stop(self, symbol, side, qty, stop):
        from ib_async import MarketOrder, StopOrder

        c = self._contract(symbol)
        parent = MarketOrder(side.value, qty)
        parent.orderId = self.ib.client.getReqId()
        parent.transmit = False
        child = StopOrder(side.opposite.value, qty, round(stop, 4))
        child.orderId = self.ib.client.getReqId()
        child.parentId = parent.orderId
        child.tif = "GTC"
        child.transmit = True  # transmitting the last child releases the whole bracket
        trade = self.ib.placeOrder(c, parent)
        self.ib.placeOrder(c, child)
        self.ib.sleep(1)
        return str(trade.order.orderId)

    def cancel_all_orders(self):
        self.ib.reqGlobalCancel()
        self.ib.sleep(1)

    def close_position(self, symbol):
        from ib_async import MarketOrder

        # Cancel resting stops FIRST, otherwise an orphan stop could open a new position.
        for t in self.ib.openTrades():
            if t.contract.symbol == symbol:
                self.ib.cancelOrder(t.order)
        self.ib.sleep(1)
        for p in self.positions():
            if p.symbol == symbol:
                side = Side.SELL if p.qty > 0 else Side.BUY
                self.ib.placeOrder(self._contract(symbol), MarketOrder(side.value, abs(p.qty)))
        self.ib.sleep(1)
