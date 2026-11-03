from __future__ import annotations

import argparse
import logging
import sys

from .bot import Bot
from .config import load_config
from .risk import RiskManager


def make_broker(cfg):
    if cfg.broker == "ib":
        from .brokers.ib import IBBroker
        return IBBroker(cfg.ib, cfg.instruments)
    from .brokers.mt5 import MT5Broker
    return MT5Broker(cfg.mt5, cfg.mt5_password())


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="trading_bot")
    p.add_argument("command", choices=["run", "status", "kill", "unkill"])
    p.add_argument("-c", "--config", default="config.toml")
    p.add_argument("--once", action="store_true", help="run a single cycle and exit")
    p.add_argument("--dry-run", action="store_true", help="log decisions, send no orders")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    cfg = load_config(args.config)
    risk = RiskManager(cfg.risk)

    if args.command == "kill":
        risk.trip_kill_switch("manual kill")
        print("Kill switch ENGAGED. A running bot will flatten and stop trading on its next cycle.")
        return 0
    if args.command == "unkill":
        risk.clear_kill_switch()
        print("Kill switch cleared.")
        return 0
    if args.command == "status":
        print("kill switch:", risk.kill_reason() or "off")
        print("risk state :", risk.state)
        return 0

    broker = make_broker(cfg)
    broker.connect()  # refuses non-paper / non-demo accounts
    try:
        bot = Bot(broker, cfg, risk, dry_run=args.dry_run)
        bot.run_cycle() if args.once else bot.run_forever()
    finally:
        broker.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
