import type {
  SecurityHolding,
  SecurityRecommendation,
  ActionPriceRange,
} from '../types';
import type { PriceHistoryPoint } from './recommendationEngine';
import type { PortfolioSnapshotSummaryRow } from './portfolioRemote';
import { priceHistoryTrendContext } from '../../../shared/historyInsights';

export type AIExportContext = {
  priceHistoryBySecurity?: Record<string, PriceHistoryPoint[]>;
  portfolioTrajectory?: PortfolioSnapshotSummaryRow[];
  totalPortfolioValue?: number;
};

function sortedPriceHistory(points?: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (!points?.length) return [];
  return [...points].sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
}

function enrichLotStats(holding: SecurityHolding) {
  const openLots = holding.lots.filter((l) => l.remainingQuantity > 0);
  let inProfit = 0;
  let inLoss = 0;
  const cp = holding.currentPrice;
  if (cp != null) {
    for (const lot of openLots) {
      const gl = lot.remainingQuantity * (cp - lot.buyPrice);
      if (gl >= 0) inProfit++;
      else inLoss++;
    }
  }
  const lastBuyDate =
    openLots.length > 0
      ? openLots.reduce((latest, lot) => (lot.buyDate > latest ? lot.buyDate : latest), '')
      : null;
  return {
    openLotCount: openLots.length,
    lotsInProfit: inProfit,
    lotsInLoss: inLoss,
    lastBuyDate,
  };
}

function formatPriceHistoryBlock(points: PriceHistoryPoint[]): object[] {
  return sortedPriceHistory(points).map((p) => ({
    date: p.tradingDate,
    lastPrice: p.lastPrice,
  }));
}

function portfolioTrajectorySection(trajectory?: PortfolioSnapshotSummaryRow[]) {
  if (!trajectory?.length) return null;
  const sorted = [...trajectory].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const valueChangePct =
    first.totalMarketValue > 0
      ? (((last.totalMarketValue - first.totalMarketValue) / first.totalMarketValue) * 100).toFixed(2)
      : null;
  return {
    snapshotCount: sorted.length,
    firstSnapshot: first.snapshotDate,
    latestSnapshot: last.snapshotDate,
    valueChangePercentSinceFirst: valueChangePct,
    points: sorted.map((r) => ({
      date: r.snapshotDate,
      totalMarketValue: r.totalMarketValue,
      totalCost: r.totalCost,
      totalUnrealizedGainLoss: r.totalUnrealizedGainLoss,
    })),
  };
}

function mapSecurityForExport(
  holding: SecurityHolding,
  recommendation: SecurityRecommendation | undefined,
  actionRange: ActionPriceRange | undefined,
  priceHistory: PriceHistoryPoint[] | undefined,
  portfolioValue: number
) {
  const realizedGainLoss = holding.lots.reduce(
    (sum, lot) => sum + lot.sellOrders.reduce((s, sell) => s + sell.gainLoss, 0),
    0
  );
  const history = sortedPriceHistory(priceHistory);
  const trendSummary = history.length ? priceHistoryTrendContext(history) : null;
  const positionPct =
    portfolioValue > 0 && holding.marketValue != null
      ? Number(((holding.marketValue / portfolioValue) * 100).toFixed(2))
      : null;

  return {
    security: holding.security,
    positionPercentOfPortfolio: positionPct,
    priceHistory: formatPriceHistoryBlock(history),
    priceTrendSummary: trendSummary,
    positionStats: enrichLotStats(holding),
    currentPosition: {
      quantity: holding.totalQuantity,
      averageBuyPrice: holding.averageBuyPrice,
      totalCost: holding.totalCost,
      currentPrice: holding.currentPrice,
      marketValue: holding.marketValue,
      unrealizedGainLoss: holding.unrealizedGainLoss,
      unrealizedGainLossPercent: holding.unrealizedGainLossPercent,
      realizedGainLoss,
    },
    actionPriceRanges: actionRange
      ? {
          breakEvenSellPrice: actionRange.breakEvenSellPrice,
          accumulateSlowly: actionRange.accumulateSlowly,
          strongAddZone: actionRange.strongAddZone,
          reEvaluateIfWeak: actionRange.reEvaluateIfWeak,
          pauseBuys: actionRange.pauseBuys,
          trimSmallPortion: actionRange.trimSmallPortion,
          trailingStop: actionRange.trailingStop,
          investmentPercentage: actionRange.investmentPercentage,
        }
      : null,
    recommendation: recommendation
      ? {
          action: recommendation.recommendation,
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          targetZones: recommendation.targetZones,
        }
      : null,
    lotDetails: holding.lots.map((lot) => {
      const currentPrice = holding.currentPrice;
      const unrealizedGainLoss =
        currentPrice && lot.remainingQuantity > 0
          ? lot.remainingQuantity * (currentPrice - lot.buyPrice)
          : null;
      const totalRealizedGainLoss = lot.sellOrders.reduce((sum, sell) => sum + sell.gainLoss, 0);

      return {
        buyDate: lot.buyDate,
        buyPrice: lot.buyPrice,
        originalBuyPrice: lot.originalBuyPrice,
        quantity: lot.quantity,
        originalQuantity: lot.originalQuantity,
        remainingQuantity: lot.remainingQuantity,
        totalCost: lot.totalCost,
        splitRatio: lot.splitRatio,
        sellOrders: lot.sellOrders.map((sell) => ({
          sellDate: sell.sellDate,
          sellPrice: sell.sellPrice,
          quantity: sell.quantity,
          gainLoss: sell.gainLoss,
          gainLossPercent: sell.gainLossPercent,
        })),
        realizedGainLoss: totalRealizedGainLoss,
        unrealizedGainLoss,
      };
    }),
  };
}

/**
 * Exports portfolio data in a structured format optimized for AI analysis
 */
export function exportAIMetadata(
  holdings: Record<string, SecurityHolding>,
  recommendations: Record<string, SecurityRecommendation>,
  actionRanges: Record<string, ActionPriceRange>,
  context: AIExportContext = {}
): string {
  const holdingsArray = Object.values(holdings).sort((a, b) =>
    a.security.localeCompare(b.security)
  );
  const totalValue =
    context.totalPortfolioValue ??
    holdingsArray.reduce((sum, h) => sum + (h.marketValue || 0), 0);

  const metadata = {
    exportDate: new Date().toISOString(),
    market: 'Colombo Stock Exchange (CSE), Sri Lanka — ATrad broker exports',
    portfolioSummary: {
      totalSecurities: holdingsArray.length,
      totalPortfolioValue: totalValue,
      totalCost: holdingsArray.reduce((sum, h) => sum + h.totalCost, 0),
      totalUnrealizedGainLoss: holdingsArray.reduce(
        (sum, h) => sum + (h.unrealizedGainLoss || 0),
        0
      ),
      securitiesWithRecommendations: Object.keys(recommendations).length,
    },
    portfolioTrajectory: portfolioTrajectorySection(context.portfolioTrajectory),
    watchlistOnlySecurities: watchlistOnlySecurities(holdings, context),
    analysisGuidance: {
      usePriceHistory:
        'Each security includes priceHistory[] from manual watchlist uploads (sparse, not daily). Use trend direction, not statistical forecast.',
      usePortfolioTrajectory:
        'portfolioTrajectory shows total book value over snapshot dates from manual portfolio CSV uploads.',
      concentration:
        'Flag any single security above 15% of portfolio value. Note sector clustering (banks, conglomerates) if visible from symbols.',
    },
    securities: holdingsArray.map((holding) =>
      mapSecurityForExport(
        holding,
        recommendations[holding.security],
        actionRanges[holding.security],
        context.priceHistoryBySecurity?.[holding.security],
        totalValue
      )
    ),
  };

  return JSON.stringify(metadata, null, 2);
}

function watchlistOnlySecurities(
  holdings: Record<string, SecurityHolding>,
  context: AIExportContext
): string[] {
  const held = new Set(Object.keys(holdings));
  return Object.keys(context.priceHistoryBySecurity ?? {})
    .filter((s) => !held.has(s))
    .sort();
}

function appendPortfolioTrajectoryMarkdown(
  lines: string[],
  context: AIExportContext
) {
  const traj = portfolioTrajectorySection(context.portfolioTrajectory);
  if (!traj) return;
  lines.push('## Portfolio value over time (manual snapshots)');
  lines.push('');
  lines.push(
    `- **Snapshots:** ${traj.snapshotCount} (${traj.firstSnapshot} → ${traj.latestSnapshot})`
  );
  if (traj.valueChangePercentSinceFirst != null) {
    lines.push(`- **Change since first snapshot:** ${traj.valueChangePercentSinceFirst}%`);
  }
  lines.push('');
  lines.push('| Date | Market value | Cost | Unrealized G/L |');
  lines.push('|------|--------------|------|----------------|');
  for (const p of traj.points) {
    lines.push(
      `| ${p.date} | ${p.totalMarketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${p.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${p.totalUnrealizedGainLoss >= 0 ? '+' : ''}${p.totalUnrealizedGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} |`
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');
}

function appendPriceHistoryMarkdown(
  lines: string[],
  security: string,
  context: AIExportContext
) {
  const history = sortedPriceHistory(context.priceHistoryBySecurity?.[security]);
  if (!history.length) return;
  const trend = priceHistoryTrendContext(history);
  lines.push('**Watchlist price history (sparse uploads):**');
  if (trend) lines.push(`- Trend: ${trend}`);
  lines.push(
    history
      .map((p) => `${p.tradingDate}: ${p.lastPrice.toFixed(2)}`)
      .join(' · ')
  );
  lines.push('');
}

/**
 * Exports portfolio data as a formatted Markdown document for AI analysis
 */
export function exportAIMarkdown(
  holdings: Record<string, SecurityHolding>,
  recommendations: Record<string, SecurityRecommendation>,
  actionRanges: Record<string, ActionPriceRange>,
  context: AIExportContext = {}
): string {
  const holdingsArray = Object.values(holdings).sort((a, b) =>
    a.security.localeCompare(b.security)
  );

  const totalValue =
    context.totalPortfolioValue ??
    holdingsArray.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  const totalCost = holdingsArray.reduce((sum, h) => sum + h.totalCost, 0);
  const totalUnrealized = holdingsArray.reduce((sum, h) => sum + (h.unrealizedGainLoss || 0), 0);

  const lines: string[] = [];

  lines.push('# CSE portfolio analysis (ATrad / manual exports)');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(
    '**Context:** Colombo Stock Exchange (CSE), Sri Lanka. Prices and portfolio totals come from periodic ATrad CSV/Excel exports — not live feeds. Do not forecast from sparse history; use direction and concentration only.'
  );
  lines.push('');
  lines.push('## Portfolio summary');
  lines.push('');
  lines.push(`- **Securities:** ${holdingsArray.length}`);
  lines.push(
    `- **Total value:** ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  lines.push(
    `- **Cost basis:** ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  lines.push(
    `- **Unrealized G/L:** ${totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalCost > 0 ? ((totalUnrealized / totalCost) * 100).toFixed(2) : '0'}%)`
  );
  lines.push('');
  appendPortfolioTrajectoryMarkdown(lines, context);
  const watchOnly = watchlistOnlySecurities(holdings, context);
  if (watchOnly.length > 0) {
    lines.push('## Watchlist only (not in holdings)');
    lines.push('');
    for (const sym of watchOnly) {
      lines.push(`### ${sym}`);
      appendPriceHistoryMarkdown(lines, sym, context);
    }
    lines.push('---');
    lines.push('');
  }

  const byRecommendation: Record<string, typeof holdingsArray> = {
    BUY_NEW: [],
    ADD_ACCUMULATE: [],
    HOLD: [],
    TRIM: [],
    EXIT: [],
    STRONG_STOP_TAKE_PROFIT: [],
    NO_RECOMMENDATION: [],
  };

  holdingsArray.forEach((holding) => {
    const rec = recommendations[holding.security];
    if (rec) {
      byRecommendation[rec.recommendation].push(holding);
    } else {
      byRecommendation.NO_RECOMMENDATION.push(holding);
    }
  });

  const priorityOrder = [
    'EXIT',
    'STRONG_STOP_TAKE_PROFIT',
    'TRIM',
    'BUY_NEW',
    'ADD_ACCUMULATE',
    'HOLD',
    'NO_RECOMMENDATION',
  ];

  for (const recType of priorityOrder) {
    const securities = byRecommendation[recType];
    if (securities.length === 0) continue;

    lines.push(`## ${recType.replace(/_/g, ' ')} (${securities.length})`);
    lines.push('');

    for (const holding of securities) {
      const recommendation = recommendations[holding.security];
      const actionRange = actionRanges[holding.security];
      const stats = enrichLotStats(holding);
      const positionPct =
        totalValue > 0 && holding.marketValue != null
          ? ((holding.marketValue / totalValue) * 100).toFixed(1)
          : null;

      lines.push(`### ${holding.security}`);
      lines.push('');
      if (positionPct) {
        lines.push(`- **Portfolio weight:** ${positionPct}%${Number(positionPct) > 15 ? ' ⚠ concentration' : ''}`);
      }
      lines.push('**Position:**');
      lines.push(`- Quantity: ${holding.totalQuantity.toFixed(0)}`);
      lines.push(`- Avg buy: ${holding.averageBuyPrice.toFixed(2)}`);
      lines.push(
        `- Cost: ${holding.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
      if (holding.currentPrice) {
        lines.push(`- Last price: ${holding.currentPrice.toFixed(2)}`);
        lines.push(
          `- Market value: ${holding.marketValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
        if (holding.unrealizedGainLoss !== undefined) {
          const sign = holding.unrealizedGainLoss >= 0 ? '+' : '';
          lines.push(
            `- Unrealized: ${sign}${holding.unrealizedGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${sign}${holding.unrealizedGainLossPercent?.toFixed(2)}%)`
          );
        }
      }
      if (stats.openLotCount > 0) {
        lines.push(
          `- Open lots: ${stats.openLotCount} (${stats.lotsInProfit} in profit, ${stats.lotsInLoss} in loss)${stats.lastBuyDate ? `; last buy ${stats.lastBuyDate}` : ''}`
        );
      }
      lines.push('');
      appendPriceHistoryMarkdown(lines, holding.security, context);

      if (holding.lots.length > 0) {
        lines.push('**Lots:**');
        lines.push('');
        lines.push(
          '| Buy date | Price | Qty | Remaining | Cost | Sells | Realized | Unrealized |'
        );
        lines.push('|----------|-------|-----|-----------|------|-------|----------|------------|');

        for (const lot of holding.lots) {
          const totalRealizedGainLoss = lot.sellOrders.reduce((sum, sell) => sum + sell.gainLoss, 0);
          const currentPrice = holding.currentPrice;
          const unrealizedGainLoss =
            currentPrice && lot.remainingQuantity > 0
              ? lot.remainingQuantity * (currentPrice - lot.buyPrice)
              : null;

          const buyPriceStr =
            lot.originalBuyPrice && lot.originalBuyPrice !== lot.buyPrice
              ? `${lot.buyPrice.toFixed(2)} (was ${lot.originalBuyPrice.toFixed(2)})`
              : lot.buyPrice.toFixed(2);

          const qtyStr =
            lot.originalQuantity && lot.originalQuantity !== lot.quantity
              ? `${lot.quantity.toFixed(0)} (was ${lot.originalQuantity})`
              : lot.quantity.toFixed(0);

          const splitInfo =
            lot.splitRatio && lot.splitRatio !== 1 ? ` ${lot.splitRatio.toFixed(2)}x` : '';

          let sellDetails = '—';
          if (lot.sellOrders.length > 0) {
            sellDetails = lot.sellOrders
              .map(
                (sell) =>
                  `${sell.quantity}@${sell.sellPrice.toFixed(2)} ${sell.sellDate} (${sell.gainLoss >= 0 ? '+' : ''}${sell.gainLoss.toFixed(2)})`
              )
              .join('; ');
          }

          const realizedStr =
            totalRealizedGainLoss !== 0
              ? `${totalRealizedGainLoss >= 0 ? '+' : ''}${totalRealizedGainLoss.toFixed(2)}`
              : '—';
          const unrealizedStr =
            unrealizedGainLoss !== null
              ? `${unrealizedGainLoss >= 0 ? '+' : ''}${unrealizedGainLoss.toFixed(2)}`
              : '—';

          lines.push(
            [
              lot.buyDate + splitInfo,
              buyPriceStr,
              qtyStr,
              lot.remainingQuantity > 0 ? lot.remainingQuantity.toFixed(0) : 'Sold',
              lot.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 }),
              sellDetails,
              realizedStr,
              unrealizedStr,
            ].join(' | ')
          );
        }
        lines.push('');
      }

      if (actionRange) {
        lines.push('**Action ranges:**');
        if (actionRange.strongAddZone) lines.push(`- Strong add: ${actionRange.strongAddZone}`);
        if (actionRange.accumulateSlowly)
          lines.push(`- Accumulate: ${actionRange.accumulateSlowly}`);
        if (actionRange.pauseBuys) lines.push(`- Pause buys: ${actionRange.pauseBuys}`);
        if (actionRange.trimSmallPortion)
          lines.push(`- Trim: ${actionRange.trimSmallPortion}`);
        if (actionRange.reEvaluateIfWeak)
          lines.push(`- Re-evaluate if weak: ${actionRange.reEvaluateIfWeak}`);
        if (actionRange.trailingStop)
          lines.push(`- Trailing stop: ${actionRange.trailingStop.toFixed(2)}`);
        lines.push('');
      }

      if (recommendation) {
        lines.push(`**Recommendation:** ${recommendation.recommendation.replace(/_/g, ' ')}`);
        lines.push(`- Confidence: ${recommendation.confidence}`);
        lines.push(`- Reason: ${recommendation.reason}`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  lines.push('## Analysis request');
  lines.push('');
  lines.push('Analyze this CSE portfolio given sparse manual data only (no ML/forecast):');
  lines.push('');
  lines.push('1. **Health & risk** — concentration (>15% single name), sector overlap, losers vs winners');
  lines.push('2. **Actions** — validate each recommendation against lots, cost basis, and watchlist trend');
  lines.push('3. **Zones** — whether action price ranges align with history and unrealized P/L');
  lines.push('4. **Trajectory** — comment on portfolio snapshot trend if provided');
  lines.push('5. **Watchlist-only** — flag symbols in price history but not in holdings (if any)');
  lines.push('');

  return lines.join('\n');
}

/**
 * Exports portfolio data for AI to generate Action Price Ranges CSV
 */
export function exportAIMetadataForActionRanges(
  holdings: Record<string, SecurityHolding>,
  context: AIExportContext = {}
): string {
  const holdingsArray = Object.values(holdings).sort((a, b) =>
    a.security.localeCompare(b.security)
  );

  const totalValue =
    context.totalPortfolioValue ??
    holdingsArray.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  const totalCost = holdingsArray.reduce((sum, h) => sum + h.totalCost, 0);

  const metadata = {
    exportDate: new Date().toISOString(),
    market: 'Colombo Stock Exchange (CSE), Sri Lanka — ATrad',
    purpose: 'Generate Action Price Ranges CSV for portfolio management',
    portfolioTrajectory: portfolioTrajectorySection(context.portfolioTrajectory),
    instructions: {
      task: 'Generate a CSV with Action Price Ranges per security. Use watchlist priceHistory where present; ranges should respect CSE tick sizes and current unrealized P/L.',
      csvFormat: {
        headers:
          'Company Code,Quantity,Avg Price,B.E.S Price,Last,Change,% Change,Accumulate Slowly,Strong Add Zone,Re-evaluate if Market Weak,Pause Buys,Trim Small Portion,Investment_Percentage,Time,Trailing Stop (SELL if below)',
      },
      outputFormat:
        'Return ONLY raw CSV (header + one row per security). No markdown or commentary.',
    },
    portfolioSummary: {
      totalSecurities: holdingsArray.length,
      totalPortfolioValue: totalValue,
      totalCost,
      totalUnrealizedGainLoss: holdingsArray.reduce(
        (sum, h) => sum + (h.unrealizedGainLoss || 0),
        0
      ),
    },
    securities: holdingsArray.map((holding) => {
      const history = sortedPriceHistory(
        context.priceHistoryBySecurity?.[holding.security]
      );
      const investmentPercentage =
        totalValue > 0 ? ((holding.marketValue || holding.totalCost) / totalValue) * 100 : 0;

      return {
        security: holding.security,
        investmentPercentage,
        priceHistory: formatPriceHistoryBlock(history),
        priceTrendSummary: history.length ? priceHistoryTrendContext(history) : null,
        currentPosition: {
          quantity: holding.totalQuantity,
          averageBuyPrice: holding.averageBuyPrice,
          totalCost: holding.totalCost,
          currentPrice: holding.currentPrice,
          marketValue: holding.marketValue,
          unrealizedGainLoss: holding.unrealizedGainLoss,
          unrealizedGainLossPercent: holding.unrealizedGainLossPercent,
        },
        breakEvenSellPrice: holding.averageBuyPrice * 1.01,
        suggestedZones: {
          strongAddZone:
            holding.currentPrice &&
            holding.unrealizedGainLossPercent &&
            holding.unrealizedGainLossPercent > 0
              ? `${(holding.currentPrice * 0.85).toFixed(2)}–${(holding.currentPrice * 0.9).toFixed(2)}`
              : holding.currentPrice
                ? `${(holding.averageBuyPrice * 0.9).toFixed(2)}–${(holding.averageBuyPrice * 0.95).toFixed(2)}`
                : undefined,
          accumulateSlowly: holding.currentPrice
            ? `${(holding.currentPrice * 0.9).toFixed(2)}–${(holding.currentPrice * 0.95).toFixed(2)}`
            : undefined,
          pauseBuys: holding.currentPrice
            ? `${(holding.currentPrice * 1.1).toFixed(2)}–${(holding.currentPrice * 1.15).toFixed(2)}`
            : undefined,
          trimSmallPortion: holding.currentPrice
            ? `${(holding.currentPrice * 1.2).toFixed(2)}+`
            : undefined,
          trailingStop:
            holding.currentPrice &&
            holding.unrealizedGainLossPercent &&
            holding.unrealizedGainLossPercent > 0
              ? holding.currentPrice * 0.9
              : holding.averageBuyPrice * 0.98,
        },
      };
    }),
    exampleCSVRow:
      'ACL.N0000,380,73.74,74.56,107.00,1.75,1.66,95-100,85-90,Below 80,115-120,130+,5.80%,13:29:03.301165,95',
  };

  return JSON.stringify(metadata, null, 2);
}