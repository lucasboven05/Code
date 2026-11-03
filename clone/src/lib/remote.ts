// The browser's data layer when a backend is configured. Reads are computed locally from the state the server
// returns (same pure engine); every change is sent to the server, which validates it and answers with the new state.
import { Service, type Store } from './data';
import { emptyState } from './engine';
import type { State } from './types';

const nullStore: Store = { load: async () => null, save: async () => {}, clear: async () => {} };
export const MUTATIONS = ['saveProfile', 'completeOnboarding', 'updateContribution', 'createPlaylist', 'updatePlaylist', 'deletePlaylist', 'investInPlaylist', 'addMoney', 'markAllNoticesRead', 'saveGoal', 'deleteGoal', 'sendChat', 'addRecap', 'setPrefs', 'setRebalance', 'setTimezone', 'resetAccount', 'deleteEverything'] as const;

export class RemoteData extends Service {
  constructor(private getToken: () => Promise<string | null>, private onUnauthorized: () => void, private fetcher: typeof fetch = (...a) => fetch(...a)) { super(nullStore); }
  protected defaultTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Panama'; }
  async call(path: string, init?: RequestInit): Promise<State> {
    const token = await this.getToken(); if (!token) { this.onUnauthorized(); throw new Error('Please sign in again.'); }
    const r = await this.fetcher(path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401) this.onUnauthorized();
    if (!r.ok) throw new Error(body.error ?? 'Something went wrong. Try again.');
    return body as State;
  }
  async load() {
    this.state = await this.call('/api/state');
    const tz = this.defaultTimezone();
    if (!this.state.profile.onboardedAt && this.state.profile.step === 0 && this.state.profile.timezone !== tz) { try { await this.setTimezone(tz); } catch { /* keep the server default */ } }
    return this.state;
  }
}
for (const m of MUTATIONS) {
  (RemoteData.prototype as unknown as Record<string, unknown>)[m] = async function (this: RemoteData, ...args: unknown[]) {
    const s = await this.call('/api/rpc', { method: 'POST', body: JSON.stringify({ method: m, args }) }); this.state = s; return s;
  };
}
export { emptyState };
