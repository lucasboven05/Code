'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { Skeleton } from '@/components/ui';

export default function Index() {
  const { ready, state } = useApp(); const router = useRouter();
  useEffect(() => { if (ready) router.replace(state.profile.onboardedAt ? '/home' : '/welcome'); }, [ready, state.profile.onboardedAt, router]);
  return <main className="page-plain"><Skeleton /></main>;
}
