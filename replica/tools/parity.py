#!/usr/bin/env python3
"""Feature parity score from replica/features.csv. Standard library only.

Weights: must 3, should 2, could 1. Credit: yes 1, partial 0.5, no 0.
Rows left out of the score: clone == skip (cannot be cloned, with a reason) and original == no (the clone's own additions).
Usage: python3 parity.py replica/features.csv [--markdown]
"""
import csv, sys
from collections import defaultdict

W = {"must": 3, "should": 2, "could": 1}
CREDIT = {"yes": 1.0, "partial": 0.5, "no": 0.0}

def load(path):
    rows = []
    for r in csv.DictReader(open(path, newline="", encoding="utf-8")):
        r = {k: (v or "").strip() for k, v in r.items()}
        if r["clone"] == "skip" or r["priority"] == "skip" or r["original"] == "no":
            continue
        if r["priority"] not in W or r["clone"] not in CREDIT:
            raise SystemExit(f"bad row: {r['feature']!r} priority={r['priority']!r} clone={r['clone']!r}")
        rows.append(r)
    return rows

def score(rows):
    tot = sum(W[r["priority"]] for r in rows)
    return 100 * sum(W[r["priority"]] * CREDIT[r["clone"]] for r in rows) / tot if tot else 0.0

def analyse(path):
    rows = load(path)
    skipped = [r for r in csv.DictReader(open(path, newline="", encoding="utf-8")) if r["clone"].strip() == "skip"]
    must = [r for r in rows if r["priority"] == "must"]
    areas = defaultdict(list)
    for r in rows: areas[r["area"]].append(r)
    order = {"must": 0, "should": 1, "could": 2}
    missing = sorted((r for r in rows if r["clone"] != "yes"), key=lambda r: (order[r["priority"]], CREDIT[r["clone"]], r["feature"]))
    return dict(rows=rows, score=score(rows), must=must, must_done=sum(r["clone"] == "yes" for r in must),
                areas=sorted(((a, score(v), len(v)) for a, v in areas.items()), key=lambda x: x[1]), missing=missing, skipped=skipped,
                counts={k: sum(r["clone"] == k for r in rows) for k in CREDIT})

def main(path, md):
    a = analyse(path); n = len(a["rows"])
    shippable = a["must_done"] == len(a["must"])
    if md:
        print(f"**Feature parity: {a['score']:.0f}%** ({n} scored features: {a['counts']['yes']} done, {a['counts']['partial']} partial, {a['counts']['no']} not built; {len(a['skipped'])} excluded as not clonable).  ")
        print(f"**Must-haves: {a['must_done']} of {len(a['must'])} done.**{'' if shippable else ' Not shippable until every must-have is done.'}\n")
        print("| area | score | features |\n|---|---|---|")
        for ar, s, c in a["areas"]: print(f"| {ar} | {s:.0f}% | {c} |")
        print("\n| # | priority | feature | status | note |\n|---|---|---|---|---|")
        for i, r in enumerate(a["missing"], 1): print(f"| {i} | {r['priority']} | {r['feature']} | {r['clone']} | {r['notes'].split('| BUILD:')[-1].strip()} |")
    else:
        print(f"feature parity {a['score']:.1f}%  ({a['counts']})  must-haves {a['must_done']}/{len(a['must'])}")
        for ar, s, c in a["areas"]: print(f"  {ar:12} {s:5.1f}%  ({c})")
        print("missing, in build order:")
        for r in a["missing"]: print(f"  [{r['priority']}] {r['feature']} ({r['clone']})")
        print("verdict:", "shippable on features" if shippable else "NOT shippable: a must-have is not done")
    return 0

if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    sys.exit(main(args[0], "--markdown" in sys.argv))
