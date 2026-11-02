export type Alloc = { ticker: string; weightBps: number };
export type InstrumentType = 'stock' | 'etf' | 'crypto';
export type Instrument = { ticker: string; name: string; type: InstrumentType; blurb: string };
export type ModelPortfolio = { id: string; name: string; riskLevel: 1 | 2 | 3 | 4 | 5; description: string; allocations: Alloc[] };

export type Profile = {
  displayName: string; birthYear: number | null; riskTolerance: number | null; horizonYears: number | null;
  goals: string[]; step: number; onboardedAt: string | null; timezone: string;
};
export type Account = { cashCents: number; netDepositsCents: number; modelId: string | null; rebalanceEnabled: boolean };
export type Holding = { ticker: string; qty: number; costBasisCents: number };
export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly';
export type Contribution = {
  id: string; amountCents: number; frequency: Frequency; dayOfWeek: number | null; dayOfMonth: number | null;
  nextRunOn: string | null; status: 'active' | 'paused' | 'done' | 'cancelled';
};
export type OrderKind = 'deposit' | 'buy' | 'sell' | 'rebalance_buy' | 'rebalance_sell';
export type Order = {
  id: string; kind: OrderKind; ticker?: string; qty?: number; price?: number; amountCents: number;
  contributionId?: string; runFor?: string; date: string; note: string;
};
export type Goal = { id: string; name: string; targetCents: number; targetYear: number };
export type Playlist = {
  id: string; owner: 'me' | null; name: string; theme: string; description: string; isPublic: boolean; items: Alloc[];
};
export type PlaylistInvestment = { playlistId: string; amountCents: number; date: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; kind: 'chat' | 'recap'; date: string };
export type NotificationPrefs = { dailyBriefing: boolean; contributionDone: boolean; rebalanceDone: boolean };

export type State = {
  v: 1;
  profile: Profile; account: Account; holdings: Holding[]; contributions: Contribution[]; orders: Order[];
  goals: Goal[]; playlists: Playlist[]; playlistInvestments: PlaylistInvestment[]; chat: ChatMessage[];
  prefs: NotificationPrefs; lastJobsOn: string | null; seq: number;
};
export type PriceAt = (ticker: string, date: string) => number;
