// Allie, the learning assistant. This is a SCRIPTED stand-in with the same interface a real LLM-backed
// version will use (server side, with your own API key; see replica/architecture.md). It only explains
// ideas and describes the user's own practice account. It never tells anyone what to buy or sell.
import type { State } from './types';
import { INSTRUMENTS, MODELS } from './seed';
import { totalValueCents } from './engine';
import { priceAt } from './prices';
import { usd } from './format';

export const DISCLAIMER = 'Allie explains ideas for learning. It is not investment advice, and this app uses practice money.';
export type AllieContext = { state: State; today: string };

function mix(ctx: AllieContext): string {
  const { state, today } = ctx; const total = state.holdings.reduce((t, h) => t + h.qty * priceAt(h.ticker, today), 0);
  if (total <= 0) return 'You do not hold anything yet. Once you invest, I can describe your mix here.';
  const rows = [...state.holdings].map((h) => ({ h, v: h.qty * priceAt(h.ticker, today) })).sort((a, b) => b.v - a.v).slice(0, 4);
  return 'Your largest holdings are ' + rows.map(({ h, v }) => `${INSTRUMENTS.find((i) => i.ticker === h.ticker)?.name ?? h.ticker} (${Math.round((v / total) * 100)}%)`).join(', ') + '.';
}

const TOPICS: { test: RegExp; answer: (c: AllieContext) => string }[] = [
  { test: /rebalanc/i, answer: () => 'Prices move, so over time some holdings grow bigger than planned. Rebalancing sells a little of what grew and buys a little of what lagged, bringing the mix back to its target. It keeps your risk close to what you chose. It can also mean selling winners, which is a trade-off worth knowing about.' },
  { test: /\betf\b|fund/i, answer: () => 'A fund (often an ETF) bundles many investments into one. Buying one share gives you a small slice of everything inside. That spreads risk compared with buying a single company. Funds still go up and down with their markets.' },
  { test: /diversif|spread/i, answer: () => 'Diversifying means not putting all your money in one place. If one company or sector falls, the others may cushion it. It reduces the damage from any single bad outcome, but it cannot remove market-wide losses.' },
  { test: /risk|safe|lose|loss/i, answer: (c) => `Risk here means how far prices can swing, and that you can lose money. Bonds usually swing less than stocks; single companies and coins swing the most. ${c.state.account.modelId ? 'Your plan is ' + (MODELS.find((m) => m.id === c.state.account.modelId)?.name ?? 'a sample portfolio') + '.' : ''} Past swings do not predict future ones.` },
  { test: /fee|cost|price|expens/i, answer: () => 'Costs eat into growth every year, so they matter more than they look. This practice app charges nothing. In real life check any subscription, fund fees and trading costs before you start.' },
  { test: /goal|retire|house|save/i, answer: () => 'Goals work best when they have an amount and a date. Open the Goals tab to see a hypothetical path to yours, and what a monthly amount would need to be under a few different growth assumptions. These are estimates, not promises.' },
  { test: /compound/i, answer: () => 'Compounding means your gains can earn gains of their own. A small amount added every month for many years can grow much more than the same total added late. The effect is real but not guaranteed, since returns vary.' },
  { test: /my (portfolio|mix|holdings)|what do i (own|hold)|explain my/i, answer: mix },
  { test: /should i (buy|sell)|what (should|do) i (buy|sell)|best stock|tip/i, answer: () => 'I cannot say what you should buy or sell. I can explain how a fund, a bond or a single company tends to behave, or walk through the trade-offs of an idea you are considering.' },
];
export function allieReply(question: string, ctx: AllieContext): string {
  const hit = TOPICS.find((t) => t.test.test(question));
  const body = hit ? hit.answer(ctx) : 'I can explain ideas like funds, diversification, rebalancing, risk and compounding, or describe your own mix. Try one of the suggestions below.';
  return body + '\n\n' + DISCLAIMER;
}
export function weeklyRecap(ctx: AllieContext): string {
  const { state, today } = ctx; const v = totalValueCents(state, today, priceAt); const net = state.account.netDepositsCents;
  if (!state.orders.length) return 'Nothing to recap yet. Set up your first plan and I will summarise it here.';
  const gain = v - net;
  return `Recap: your practice account is worth ${usd(v)}. You have put in ${usd(net)}, so the difference is ${usd(gain, { sign: true })}. ${mix(ctx)} ${DISCLAIMER}`;
}
export const SUGGESTIONS = ['Explain my mix', 'What is an ETF?', 'What does rebalancing do?', 'How does compounding work?'];
