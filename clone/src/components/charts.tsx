'use client';
import { useState } from 'react';
import { usd, dateFmt } from '@/lib/format';

const COLORS = ['var(--c-chart-1)', 'var(--c-chart-2)', 'var(--c-chart-3)', 'var(--c-chart-4)', 'var(--c-chart-5)', 'var(--c-chart-6)'];
export function Donut({ slices, label }: { slices: { name: string; weight: number }[]; label: string }) {
  let acc = 0; const total = slices.reduce((t, s) => t + s.weight, 0) || 1;
  return <div className="flex items-center gap-5 flex-wrap">
    <svg width="132" height="132" viewBox="0 0 42 42" role="img" aria-label={label}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--c-surface-2)" strokeWidth="6" />
      {slices.map((s, i) => { const pct = (s.weight / total) * 100; const el = <circle key={s.name} cx="21" cy="21" r="15.9" fill="none" stroke={COLORS[i % 6]} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={25 - acc} />; acc += pct; return el; })}
    </svg>
    <ul className="m-0 p-0 list-none grid gap-1 text-sm flex-1 min-w-[160px]">
      {slices.map((s, i) => <li key={s.name} className="flex items-center gap-2"><i style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % 6], flex: 'none' }} /><span className="flex-1">{s.name}</span><b>{Math.round((s.weight / total) * 100)}%</b></li>)}
    </ul></div>;
}

/** Line chart with touch/mouse reading. points: x label + value in cents or dollars (unit decides label). */
export function LineChart({ points, unit = 'cents', label, height = 110 }: { points: { date: string; v: number }[]; unit?: 'cents' | 'dollars' | 'index'; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted m-0">Not enough history to draw a chart yet. Check back after a few market days.</p>;
  const w = 300, h = height; const vs = points.map((p) => p.v); const mn = Math.min(...vs), mx = Math.max(...vs), span = mx - mn || 1;
  const X = (i: number) => (i / (points.length - 1)) * w, Y = (v: number) => h - 8 - ((v - mn) / span) * (h - 16);
  const fmt = (v: number) => (unit === 'cents' ? usd(v) : unit === 'index' ? v.toFixed(1) : '$' + v.toFixed(2));
  const i = hover ?? points.length - 1; const up = points[points.length - 1].v >= points[0].v;
  const move = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; setHover(Math.max(0, Math.min(points.length - 1, Math.round(x * (points.length - 1))))); };
  return <div className="grid gap-1">
    <div className="flex justify-between text-sm"><b>{fmt(points[i].v)}</b><span className="muted">{dateFmt(points[i].date)}</span></div>
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label={`${label}. ${up ? 'Up' : 'Down'} from ${fmt(points[0].v)} to ${fmt(points[points.length - 1].v)}.`}
      onPointerMove={move} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="var(--c-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <polyline fill="none" stroke="var(--c-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" points={points.map((p, k) => `${X(k).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')} />
      <circle cx={X(i)} cy={Y(points[i].v)} r="4" fill="var(--c-accent)" />
    </svg></div>;
}
