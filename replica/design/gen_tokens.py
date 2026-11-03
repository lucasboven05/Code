#!/usr/bin/env python3
"""tokens.json -> tokens.css + tailwind.theme.ts. One source of truth; run after editing tokens.json (or after replica-brand changes values)."""
import json
t = json.load(open("tokens.json"))
def block(sel, cols):
    return sel + " {\n" + "".join(f"  --c-{k}: {v};\n" for k, v in cols.items()) + "}\n"
css = ["/* GENERATED from tokens.json by gen_tokens.py. Do not edit by hand. */\n", ":root {\n"]
for k, v in t["type"].items():
    css += [f"  --fs-{k}: {v['size']/16}rem;\n", f"  --lh-{k}: {v['line']/16}rem;\n", f"  --fw-{k}: {v['weight']};\n"]
for i, s in enumerate(t["space"]): css.append(f"  --sp-{i}: {s/16}rem;\n")
for k, v in t["radius"].items(): css.append(f"  --r-{k}: {v}px;\n")
for k, v in t["shadow"].items(): css.append(f"  --shadow-{k}: {v};\n")
m = t["motion"]; css += [f"  --dur-fast: {m['fast']};\n", f"  --dur-base: {m['base']};\n", f"  --ease: {m['ease']};\n"]
L = t["layout"]; css += [f"  --content-max: {L['content_max']}px;\n", f"  --header-h: {L['header_h']}px;\n", f"  --tabbar-h: {L['tabbar_h']}px;\n", f"  --gutter: {L['gutter']}px;\n"]
f = t["fonts"]; css += [f"  --font-display: \"{f['display']['family']}\", {f['display']['fallback']};\n", f"  --font-body: \"{f['body']['family']}\", {f['body']['fallback']};\n"]
for k, v in t["colors"]["light"].items(): css.append(f"  --c-{k}: {v};\n")
css.append("}\n")
css.append("@media (prefers-color-scheme: dark) {\n" + block(":root:not([data-theme=\"light\"])", t["colors"]["dark"]).replace("\n", "\n  ").rstrip() + "\n}\n")
css.append(block(":root[data-theme=\"dark\"]", t["colors"]["dark"]))
css.append("@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 0ms; --dur-base: 0ms; } }\n")
open("tokens.css", "w").write("".join(css))
colors = ",\n      ".join(f"'{k}': 'var(--c-{k})'" for k in t["colors"]["light"])
ts = f"""// GENERATED from tokens.json by gen_tokens.py. Components use `bg-surface text-muted`, never raw hex.
import type {{ Config }} from 'tailwindcss';
export default {{
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {{
    extend: {{
      colors: {{
      {colors},
        muted: 'var(--c-text-muted)'
      }},
      fontFamily: {{ display: ['var(--font-display)'], body: ['var(--font-body)'] }},
      fontSize: {{ {", ".join(f"{k!r}: ['var(--fs-{k})', {{ lineHeight: 'var(--lh-{k})', fontWeight: 'var(--fw-{k})' }}]" for k in t["type"])} }},
      borderRadius: {{ {", ".join(f"{k!r}: 'var(--r-{k})'" for k in t["radius"])} }},
      boxShadow: {{ card: 'var(--shadow-card)', sheet: 'var(--shadow-sheet)' }},
      maxWidth: {{ content: 'var(--content-max)' }},
      transitionDuration: {{ fast: 'var(--dur-fast)', base: 'var(--dur-base)' }},
      transitionTimingFunction: {{ DEFAULT: 'var(--ease)' }},
    }},
  }},
}} satisfies Partial<Config>;
"""
open("tailwind.theme.ts", "w").write(ts)
print("wrote tokens.css, tailwind.theme.ts")
