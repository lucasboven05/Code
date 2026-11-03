#!/usr/bin/env python3
"""WCAG 2.x contrast check for tokens.json. Exit 1 if any pair fails its minimum.
Usage: python3 contrast.py tokens.json"""
import json, sys

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip("#"); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

def main(path):
    t = json.load(open(path)); fails = 0; total = 0
    for theme, cols in t["colors"].items():
        print(f"== {theme} ==")
        for fg, bg, minimum, label in t["pairs"]:
            r = ratio(cols[fg], cols[bg]); ok = r >= minimum; total += 1
            if not ok: fails += 1
            print(f"{'PASS' if ok else 'FAIL'}  {r:5.2f}  (min {minimum})  {fg} on {bg}  - {label}")
    print(f"\n{total - fails}/{total} pairs pass AA, {fails} fail")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
