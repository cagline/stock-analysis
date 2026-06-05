import type { PriceHistoryRow } from '../features/portfolio/utils/portfolioRemote';
import type {
  PortfolioSnapshotRow,
  PortfolioSnapshotSummaryRow,
} from '../features/portfolio/utils/portfolioRemote';

export type InsightCard = {
  label: string;
  value: string;
  hint?: string;
};

function sortByDateAsc<T extends { tradingDate?: string; snapshotDate?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = a.tradingDate ?? a.snapshotDate ?? '';
    const db = b.tradingDate ?? b.snapshotDate ?? '';
    return da.localeCompare(db);
  });
}

function pctChange(from: number, to: number): string {
  if (!from || !Number.isFinite(from)) return '—';
  const pct = ((to - from) / from) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function computePriceInsights(rows: PriceHistoryRow[]): InsightCard[] {
  if (rows.length === 0) return [];
  const sorted = sortByDateAsc(rows);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const highs = sorted.map((r) => r.highPrice ?? r.lastPrice).filter((n) => n != null && n > 0) as number[];
  const lows = sorted.map((r) => r.lowPrice ?? r.lastPrice).filter((n) => n != null && n > 0) as number[];
  const peak = highs.length ? Math.max(...highs) : last.lastPrice;
  const trough = lows.length ? Math.min(...lows) : last.lastPrice;
  const distFromPeak =
    peak > 0 ? (((last.lastPrice - peak) / peak) * 100).toFixed(2) : null;

  const cards: InsightCard[] = [
    {
      label: 'Latest price',
      value: last.lastPrice.toFixed(2),
      hint: last.tradingDate,
    },
  ];

  if (sorted.length >= 2) {
    cards.push({
      label: 'Since first snapshot',
      value: `${first.lastPrice.toFixed(2)} → ${last.lastPrice.toFixed(2)}`,
      hint: pctChange(first.lastPrice, last.lastPrice),
    });
    if (prev) {
      cards.push({
        label: 'Since previous snapshot',
        value: `${prev.lastPrice.toFixed(2)} → ${last.lastPrice.toFixed(2)}`,
        hint: pctChange(prev.lastPrice, last.lastPrice),
      });
    }
  }

  cards.push({
    label: 'Observed range',
    value: `${trough.toFixed(2)} – ${peak.toFixed(2)}`,
    hint: `Across ${sorted.length} snapshot${sorted.length !== 1 ? 's' : ''}`,
  });

  if (distFromPeak != null && Number(distFromPeak) < 0) {
    cards.push({
      label: 'Below observed peak',
      value: `${Math.abs(Number(distFromPeak)).toFixed(2)}%`,
      hint: `Peak ${peak.toFixed(2)}`,
    });
  }

  return cards;
}

export function computePortfolioSecurityInsights(rows: PortfolioSnapshotRow[]): InsightCard[] {
  if (rows.length === 0) return [];
  const sorted = sortByDateAsc(rows);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const cards: InsightCard[] = [
    {
      label: 'Latest position',
      value: last.quantity != null ? `${last.quantity} shares` : '—',
      hint: last.snapshotDate,
    },
  ];

  if (last.marketValue != null) {
    cards.push({
      label: 'Market value',
      value: last.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      hint: last.snapshotDate,
    });
  }

  if (sorted.length >= 2 && first.marketValue != null && last.marketValue != null) {
    cards.push({
      label: 'Value since first snapshot',
      value: pctChange(first.marketValue, last.marketValue),
      hint: `${first.marketValue.toLocaleString()} → ${last.marketValue.toLocaleString()}`,
    });
  }

  if (
    prev &&
    last.unrealizedGainLoss != null &&
    prev.unrealizedGainLoss != null
  ) {
    const delta = last.unrealizedGainLoss - prev.unrealizedGainLoss;
    cards.push({
      label: 'Unrealized G/L vs prior',
      value: `${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      hint: delta >= 0 ? 'Improving' : 'Worsening',
    });
  }

  if (first.quantity != null && last.quantity != null && first.quantity !== last.quantity) {
    const delta = last.quantity - first.quantity;
    cards.push({
      label: 'Position size change',
      value: `${delta >= 0 ? '+' : ''}${delta}`,
      hint: `${first.quantity} → ${last.quantity}`,
    });
  }

  return cards;
}

export function computePortfolioAggregateInsights(
  summary: PortfolioSnapshotSummaryRow[]
): InsightCard[] {
  if (summary.length === 0) return [];
  const sorted = [...summary].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const cards: InsightCard[] = [
    {
      label: 'Total portfolio value',
      value: last.totalMarketValue.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      hint: last.snapshotDate,
    },
    {
      label: 'Total cost basis',
      value: last.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      hint: last.snapshotDate,
    },
    {
      label: 'Total unrealized G/L',
      value: `${last.totalUnrealizedGainLoss >= 0 ? '+' : ''}${last.totalUnrealizedGainLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      hint:
        last.totalCost > 0
          ? pctChange(last.totalCost, last.totalCost + last.totalUnrealizedGainLoss)
          : undefined,
    },
  ];

  if (sorted.length >= 2) {
    cards.push({
      label: 'Growth since first snapshot',
      value: pctChange(first.totalMarketValue, last.totalMarketValue),
      hint: `${first.snapshotDate} → ${last.snapshotDate}`,
    });
  }

  return cards;
}

/** Chart-friendly rows sorted ascending by date */
export function priceChartData(rows: PriceHistoryRow[]) {
  return sortByDateAsc(rows).map((r) => ({
    date: r.tradingDate,
    last: r.lastPrice,
    high: r.highPrice,
    low: r.lowPrice,
  }));
}

export function portfolioSecurityChartData(rows: PortfolioSnapshotRow[]) {
  return sortByDateAsc(rows).map((r) => ({
    date: r.snapshotDate,
    marketValue: r.marketValue ?? 0,
    totalCost: r.totalCost ?? 0,
  }));
}

export function portfolioSummaryChartData(summary: PortfolioSnapshotSummaryRow[]) {
  return [...summary]
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .map((r) => ({
      date: r.snapshotDate,
      marketValue: r.totalMarketValue,
      totalCost: r.totalCost,
      unrealized: r.totalUnrealizedGainLoss,
    }));
}

export type PriceHistoryPoint = { tradingDate: string; lastPrice: number };

/** Trend text for recommendation enrichment */
export function priceHistoryTrendContext(points: PriceHistoryPoint[]): string | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  const first = sorted[0].lastPrice;
  const last = sorted[sorted.length - 1].lastPrice;
  const peak = Math.max(...sorted.map((p) => p.lastPrice));
  const peakDate = sorted.find((p) => p.lastPrice === peak)?.tradingDate;

  const parts: string[] = [];
  if (last < first) {
    parts.push(`Price trending down over ${sorted.length} snapshots (${first.toFixed(2)} → ${last.toFixed(2)})`);
  } else if (last > first) {
    parts.push(`Price trending up over ${sorted.length} snapshots (${first.toFixed(2)} → ${last.toFixed(2)})`);
  }

  if (peak > last && peakDate) {
    const pct = (((last - peak) / peak) * 100).toFixed(1);
    parts.push(`${Math.abs(Number(pct))}% below observed high on ${peakDate}`);
  }

  return parts.length ? parts.join('. ') : null;
}
