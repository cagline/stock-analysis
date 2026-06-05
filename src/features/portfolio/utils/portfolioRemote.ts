import type { ActionPriceRange, Order, StockSplit } from '../types';
import type { WatchlistRow, PortfolioRow } from './csvParser';

export type PriceHistoryRow = {
  security: string;
  tradingDate: string;
  lastPrice: number;
  bidPrice?: number;
  askPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  turnover?: number;
  changeAmount?: number;
  changePercent?: number;
  observedAt?: string;
  sourceFile?: string;
  updatedAt?: string;
};

export type PortfolioBootstrap = {
  orders: Order[];
  stockSplits: StockSplit[];
  currentPrices: Record<string, number>;
  actionPriceRanges: Record<string, ActionPriceRange>;
  portfolioAdjustments: Record<
    string,
    {
      salesCommission: number;
      salesProceeds: number;
      unrealizedGainLoss: number;
    }
  >;
};

function apiBase(): string {
  return import.meta.env.VITE_PORTFOLIO_API_BASE ?? '';
}

async function parseJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Returns null if API unreachable or non-OK (offline / server down). */
export async function fetchPortfolioBootstrap(): Promise<PortfolioBootstrap | null> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/bootstrap`);
    return parseJson<PortfolioBootstrap>(res);
  } catch {
    return null;
  }
}

export async function putPortfolioOrders(orders: Order[]): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orders),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function putStockSplits(splits: StockSplit[]): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/stock-splits`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(splits),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function putSecurityPrices(prices: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/prices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function putActionPriceRanges(
  ranges: Record<string, ActionPriceRange>
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/action-ranges`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ranges),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function putPortfolioAdjustments(
  adjustments: PortfolioBootstrap['portfolioAdjustments']
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/adjustments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adjustments),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function postPriceHistory(
  rows: WatchlistRow[],
  tradingDate: string,
  sourceFile?: string
): Promise<{ ok: boolean; upserted?: number; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/prices/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradingDate, sourceFile, rows }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? res.statusText };
    }
    const body = (await res.json()) as { upserted?: number };
    return { ok: true, upserted: body.upserted };
  } catch {
    return { ok: false, error: 'API unreachable' };
  }
}

export type PriceHistoryQuery = {
  security?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function fetchPriceHistory(
  query: PriceHistoryQuery = {}
): Promise<{ rows: PriceHistoryRow[] } | null> {
  try {
    const params = new URLSearchParams();
    if (query.security) params.set('security', query.security);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await fetch(
      `${apiBase()}/api/portfolio/prices/history${qs ? `?${qs}` : ''}`
    );
    return parseJson<{ rows: PriceHistoryRow[] }>(res);
  } catch {
    return null;
  }
}

export async function fetchPriceHistorySecurities(): Promise<string[] | null> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/prices/history/securities`);
    const data = await parseJson<{ securities: string[] }>(res);
    return data?.securities ?? null;
  } catch {
    return null;
  }
}

export type PortfolioSnapshotRow = {
  security: string;
  snapshotDate: string;
  quantity?: number;
  avgPrice?: number;
  totalCost?: number;
  tradedPrice?: number;
  marketValue?: number;
  salesCommission: number;
  salesProceeds: number;
  unrealizedGainLoss?: number;
  unrealizedGainLossPct?: number;
  unrealizedTodayGainLoss?: number;
  observedAt?: string;
  sourceFile?: string;
  updatedAt?: string;
};

export async function postPortfolioSnapshotHistory(
  rows: PortfolioRow[],
  snapshotDate: string,
  sourceFile?: string
): Promise<{ ok: boolean; upserted?: number; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/snapshots/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotDate, sourceFile, rows }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? res.statusText };
    }
    const body = (await res.json()) as { upserted?: number };
    return { ok: true, upserted: body.upserted };
  } catch {
    return { ok: false, error: 'API unreachable' };
  }
}

export type PortfolioSnapshotQuery = {
  security?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function fetchPortfolioSnapshotHistory(
  query: PortfolioSnapshotQuery = {}
): Promise<{ rows: PortfolioSnapshotRow[] } | null> {
  try {
    const params = new URLSearchParams();
    if (query.security) params.set('security', query.security);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await fetch(
      `${apiBase()}/api/portfolio/snapshots/history${qs ? `?${qs}` : ''}`
    );
    return parseJson<{ rows: PortfolioSnapshotRow[] }>(res);
  } catch {
    return null;
  }
}

export async function fetchPortfolioSnapshotSecurities(): Promise<string[] | null> {
  try {
    const res = await fetch(`${apiBase()}/api/portfolio/snapshots/history/securities`);
    const data = await parseJson<{ securities: string[] }>(res);
    return data?.securities ?? null;
  } catch {
    return null;
  }
}

export type PortfolioSnapshotSummaryRow = {
  snapshotDate: string;
  totalMarketValue: number;
  totalCost: number;
  totalUnrealizedGainLoss: number;
};

export async function fetchPortfolioSnapshotSummary(query?: {
  from?: string;
  to?: string;
}): Promise<{ rows: PortfolioSnapshotSummaryRow[] } | null> {
  try {
    const params = new URLSearchParams();
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    const qs = params.toString();
    const res = await fetch(
      `${apiBase()}/api/portfolio/snapshots/history/summary${qs ? `?${qs}` : ''}`
    );
    return parseJson<{ rows: PortfolioSnapshotSummaryRow[] }>(res);
  } catch {
    return null;
  }
}
