'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from './Provider';
import { Skeleton } from './ui';

const TABS = [
  { href: '/home', label: 'Home', d: 'M4 11l8-7 8 7v9H4z' },
  { href: '/playlists', label: 'Playlists', d: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/goals', label: 'Goals', d: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 5a3 3 0 100 6 3 3 0 000-6z' },
  { href: '/allie', label: 'Allie', d: 'M5 5h14v10H9l-4 4z' },
];
export function AppShell({ title, back, action, children }: { title: string; back?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { state, ready } = useApp(); const path = usePathname(); const router = useRouter();
  const onboarded = !!state.profile.onboardedAt;
  useEffect(() => { if (ready && !onboarded) router.replace('/welcome'); }, [ready, onboarded, router]);
  const section = '/' + path.split('/')[1];
  return <>
    <header className="topbar"><div className="topbar-in">
      <div className="row">{back && <Link href={back} className="btn btn-ghost btn-sm" aria-label="Back">←</Link>}<h1 className="h2">{title}</h1></div>
      <div className="row">{action}<Link href="/settings" className="btn btn-ghost btn-sm" aria-label="Settings">Settings</Link></div></div></header>
    <main className="page">{ready && onboarded ? children : <Skeleton lines={4} />}</main>
    <nav className="tabbar" aria-label="Main"><div className="tabbar-in">
      {TABS.map((t) => <Link key={t.href} href={t.href} className="tab" aria-current={section === t.href ? 'page' : undefined}><svg viewBox="0 0 24 24" aria-hidden><path d={t.d} /></svg>{t.label}</Link>)}
    </div></nav></>;
}
export function PlainPage({ title, back, children }: { title?: string; back?: string; children: React.ReactNode }) {
  return <main className="page-plain">{(title || back) && <div className="row">{back && <Link href={back} className="btn btn-ghost btn-sm" aria-label="Back">←</Link>}{title && <h1 className="h1">{title}</h1>}</div>}{children}</main>;
}
