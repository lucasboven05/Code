'use client';
import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...p }: BtnProps) {
  return <button {...p} disabled={disabled || loading} aria-busy={loading || undefined} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${className}`}>{loading ? 'Working…' : children}</button>;
}
export function LinkButton({ href, variant = 'primary', size = 'md', children }: { href: string; variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg'; children: React.ReactNode }) {
  return <Link href={href} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''}`}>{children}</Link>;
}
export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: (a: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => React.ReactNode }) {
  const id = useId(); const dId = id + '-d';
  return <div className="field"><label htmlFor={id}>{label}</label>{children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? dId : undefined })}
    {error ? <span id={dId} className="errmsg" role="alert">⚠ {error}</span> : hint ? <span id={dId} className="muted">{hint}</span> : null}</div>;
}
export function TextField({ label, error, hint, ...p }: { label: string; error?: string | null; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} error={error} hint={hint}>{(a) => <input {...a} {...p} className="input" />}</Field>;
}
export function AmountField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label><div className="amount-wrap"><span className="cur" aria-hidden>$</span>
    <input id={id} className="amount" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-e' : undefined} placeholder="0.00" /></div>
    {error && <span id={id + '-e'} className="errmsg" role="alert">⚠ {error}</span>}</div>;
}
/** One answer from a list (radio group) or several (checkbox group). */
export function ChoiceGroup<T extends string | number>({ label, options, value, onChange, multi }: { label: string; options: { value: T; label: string; hint?: string }[]; value: T | T[] | null; onChange: (v: any) => void; multi?: boolean }) {
  const sel = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const tab = (i: number) => (multi ? undefined : (value == null ? i === 0 : sel(options[i].value)) ? 0 : -1);   // radios: one stop in the Tab order, arrows move inside
  const arrow = (e: React.KeyboardEvent<HTMLElement>, i: number) => {
    if (multi) return; const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
    e.preventDefault(); const n = (i + d + options.length) % options.length; onChange(options[n].value); (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return <div role={multi ? 'group' : 'radiogroup'} aria-label={label} className="flex flex-col gap-2">
    {options.map((o, i) => <button type="button" key={String(o.value)} role={multi ? 'checkbox' : 'radio'} aria-checked={sel(o.value)} className="choice" tabIndex={tab(i)} onKeyDown={(e) => arrow(e, i)}
      onClick={() => onChange(multi ? (sel(o.value) ? (value as T[]).filter((x) => x !== o.value) : [...((value as T[]) ?? []), o.value]) : o.value)}>
      <span className="dot" aria-hidden>{sel(o.value) ? '✓' : ''}</span><span><span className="block">{o.label}</span>{o.hint && <span className="muted block">{o.hint}</span>}</span></button>)}
  </div>;
}
export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const arrow = (e: React.KeyboardEvent<HTMLElement>, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return;
    e.preventDefault(); const n = (i + d + options.length) % options.length; onChange(options[n].value); (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return <div className="seg" role="radiogroup" aria-label={label}>{options.map((o, i) => <button type="button" key={String(o.value)} role="radio" aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1} onKeyDown={(e) => arrow(e, i)} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}
export function Banner({ kind = 'warning', children }: { kind?: 'warning' | 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}><span aria-hidden>{kind === 'success' ? '✓' : kind === 'error' ? '⚠' : 'ⓘ'}</span><div>{children}</div></div>;
}
export function Skeleton({ lines = 3 }: { lines?: number }) { return <div className="card" aria-busy="true" aria-label="Loading">{Array.from({ length: lines }, (_, i) => <div key={i} className="skel" style={{ width: `${90 - i * 18}%` }} />)}</div>; }
export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="card empty"><div className="h2">{title}</div><p className="muted" style={{ margin: 0 }}>{text}</p>{action}</div>;
}
/** After a sheet closes, swallow taps for a moment: a quick second tap on the confirm button would otherwise land on whatever is now underneath. */
function clickShield(ms = 450) {
  if (typeof document === 'undefined') return; const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:fixed;inset:0;z-index:200;background:transparent';
  document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLElement>('input,button,select')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab' && ref.current) { const f = ref.current.querySelectorAll<HTMLElement>('input,button,select,a[href]'); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); clickShield(); prev?.focus(); };
  }, [onClose]);
  return <div className="scrim" onClick={onClose}><div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}><span className="grab" aria-hidden /><div className="h2">{title}</div>{children}</div></div>;
}
export const Disclaimer = ({ children }: { children?: React.ReactNode }) => <Banner kind="warning">{children ?? 'Practice money and fictional sample investments. Nothing here is investment advice.'}</Banner>;
