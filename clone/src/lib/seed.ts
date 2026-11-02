import type { Instrument, ModelPortfolio, Playlist } from './types';

// All instruments are FICTIONAL sample securities with synthetic prices. Tickers carry an S-/FX-/X- prefix so
// they can never be mistaken for real ones. A real market-data provider replaces src/lib/prices.ts later.
export type InstSeed = Instrument & { base: number; mu: number; sigma: number };
export const INSTRUMENTS: InstSeed[] = [
  { ticker: 'S-US', name: 'Sample US Broad Market Fund', type: 'etf', blurb: 'A fictional fund holding a wide mix of large companies.', base: 100, mu: 0.08, sigma: 0.16 },
  { ticker: 'S-INT', name: 'Sample International Fund', type: 'etf', blurb: 'A fictional fund spread across companies outside the US.', base: 60, mu: 0.06, sigma: 0.17 },
  { ticker: 'S-BND', name: 'Sample Bond Fund', type: 'etf', blurb: 'A fictional fund of medium-term bonds. Usually calmer than stocks.', base: 80, mu: 0.03, sigma: 0.05 },
  { ticker: 'S-STB', name: 'Sample Short-Term Bond Fund', type: 'etf', blurb: 'A fictional fund of very short bonds. Moves very little.', base: 50, mu: 0.025, sigma: 0.015 },
  { ticker: 'S-DIV', name: 'Sample Dividend Fund', type: 'etf', blurb: 'A fictional fund of companies that pay regular dividends.', base: 70, mu: 0.06, sigma: 0.12 },
  { ticker: 'S-GRW', name: 'Sample Growth Fund', type: 'etf', blurb: 'A fictional fund of fast-growing companies. Bigger swings.', base: 120, mu: 0.1, sigma: 0.24 },
  { ticker: 'S-REIT', name: 'Sample Property Fund', type: 'etf', blurb: 'A fictional fund of property-owning companies.', base: 45, mu: 0.055, sigma: 0.18 },
  { ticker: 'FX-AQUA', name: 'Aquaflow Utilities (fictional)', type: 'stock', blurb: 'Fictional company that treats and delivers drinking water.', base: 55, mu: 0.06, sigma: 0.2 },
  { ticker: 'FX-SOLR', name: 'Solarbridge Energy (fictional)', type: 'stock', blurb: 'Fictional maker of solar panels and home batteries.', base: 32, mu: 0.09, sigma: 0.38 },
  { ticker: 'FX-WIND', name: 'Greenwind Power (fictional)', type: 'stock', blurb: 'Fictional operator of wind farms.', base: 28, mu: 0.07, sigma: 0.3 },
  { ticker: 'FX-QNTM', name: 'Quantaware Systems (fictional)', type: 'stock', blurb: 'Fictional software company building machine-learning tools.', base: 210, mu: 0.14, sigma: 0.42 },
  { ticker: 'FX-CHIP', name: 'Chipforge Semiconductors (fictional)', type: 'stock', blurb: 'Fictional designer of computer chips.', base: 150, mu: 0.12, sigma: 0.4 },
  { ticker: 'FX-CLOD', name: 'Cloudharbor Software (fictional)', type: 'stock', blurb: 'Fictional provider of business software over the internet.', base: 180, mu: 0.1, sigma: 0.32 },
  { ticker: 'FX-MEDI', name: 'Medigen Health (fictional)', type: 'stock', blurb: 'Fictional maker of medical devices.', base: 95, mu: 0.07, sigma: 0.22 },
  { ticker: 'FX-BEVR', name: 'Brightleaf Beverages (fictional)', type: 'stock', blurb: 'Fictional maker of low-sugar drinks.', base: 40, mu: 0.05, sigma: 0.19 },
  { ticker: 'X-COIN', name: 'Sample Coin (simulated)', type: 'crypto', blurb: 'A simulated digital coin. Real ones can fall very fast.', base: 3000, mu: 0.15, sigma: 0.7 },
  { ticker: 'X-TOK', name: 'Sample Token (simulated)', type: 'crypto', blurb: 'A second simulated digital coin with wild swings.', base: 20, mu: 0.1, sigma: 0.9 },
];

const A = (ticker: string, weightBps: number) => ({ ticker, weightBps });
export const MODELS: ModelPortfolio[] = [
  { id: 'm1', name: 'Steady', riskLevel: 1, description: 'Mostly bonds. Small ups and downs, slow growth.', allocations: [A('S-BND', 5000), A('S-STB', 3000), A('S-US', 1500), A('S-INT', 500)] },
  { id: 'm2', name: 'Careful', riskLevel: 2, description: 'More bonds than stocks, with some dividend payers.', allocations: [A('S-BND', 4000), A('S-US', 3000), A('S-DIV', 1000), A('S-INT', 1000), A('S-STB', 1000)] },
  { id: 'm3', name: 'Balanced', riskLevel: 3, description: 'A middle path between stocks and bonds.', allocations: [A('S-US', 4000), A('S-BND', 3000), A('S-INT', 1500), A('S-DIV', 1000), A('S-REIT', 500)] },
  { id: 'm4', name: 'Growth', riskLevel: 4, description: 'Mostly stocks, built for long horizons. Expect bigger swings.', allocations: [A('S-US', 5000), A('S-INT', 2000), A('S-GRW', 1500), A('S-BND', 1000), A('S-REIT', 500)] },
  { id: 'm5', name: 'Bold', riskLevel: 5, description: 'Nearly all stocks, tilted to growth. Large swings are normal.', allocations: [A('S-US', 4000), A('S-GRW', 3000), A('S-INT', 2000), A('S-REIT', 500), A('S-BND', 500)] },
];

export const BUILTIN_PLAYLISTS: Playlist[] = [
  { id: 'p-clean', owner: null, name: 'Clean power', theme: 'Energy', description: 'Sample companies that make energy without burning fuel.', isPublic: true, items: [A('FX-SOLR', 4000), A('FX-WIND', 4000), A('FX-AQUA', 2000)] },
  { id: 'p-smart', owner: null, name: 'Smart machines', theme: 'Technology', description: 'Sample companies behind chips and machine-learning software.', isPublic: true, items: [A('FX-QNTM', 4000), A('FX-CHIP', 3500), A('FX-CLOD', 2500)] },
  { id: 'p-well', owner: null, name: 'Healthy living', theme: 'Health', description: 'Sample companies in medical devices and better-for-you drinks.', isPublic: true, items: [A('FX-MEDI', 5000), A('FX-BEVR', 3000), A('S-DIV', 2000)] },
  { id: 'p-paycheck', owner: null, name: 'Steady paycheck', theme: 'Income', description: 'A sample mix aimed at regular payouts.', isPublic: true, items: [A('S-DIV', 5000), A('S-REIT', 3000), A('S-BND', 2000)] },
  { id: 'p-crypto', owner: null, name: 'Crypto curious', theme: 'Digital coins', description: 'Two simulated coins. A way to feel the swings, with fake money.', isPublic: true, items: [A('X-COIN', 6000), A('X-TOK', 4000)] },
];
