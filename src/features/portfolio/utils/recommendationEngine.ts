import type { SecurityHolding, ActionPriceRange, SecurityRecommendation, TradingRecommendation } from '../types';
import {
  priceHistoryTrendContext,
  type PriceHistoryPoint,
} from '../../../shared/historyInsights';

export type { PriceHistoryPoint };

/**
 * Parses a price range string like "245–250", "280+", "Below 230"
 * Returns { min, max } or null if invalid
 */
export function parsePriceRange(range: string): { min: number; max: number } | null {
  if (!range || range.trim() === '') return null;

  const trimmed = range.trim();
  
  // Handle "Below X" format
  if (trimmed.toLowerCase().startsWith('below')) {
    const value = parseFloat(trimmed.replace(/below/gi, '').trim());
    if (!isNaN(value)) {
      return { min: 0, max: value };
    }
    return null;
  }

  // Handle "X+" format
  if (trimmed.endsWith('+')) {
    const value = parseFloat(trimmed.replace('+', '').trim());
    if (!isNaN(value)) {
      return { min: value, max: Infinity };
    }
    return null;
  }

  // Handle "X–Y" or "X-Y" format (en dash, em dash, or hyphen)
  const dashMatch = trimmed.match(/^([\d.]+)[\u2013\u2014-]+([\d.]+)$/);
  if (dashMatch) {
    const min = parseFloat(dashMatch[1]);
    const max = parseFloat(dashMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }

  // Try to parse as single number
  const singleValue = parseFloat(trimmed);
  if (!isNaN(singleValue)) {
    return { min: singleValue, max: singleValue };
  }

  return null;
}

/**
 * Checks if a price falls within a price range
 */
function isPriceInRange(price: number, range: { min: number; max: number } | null): boolean {
  if (!range) return false;
  return price >= range.min && price <= range.max;
}

/**
 * Checks if a price is below a threshold
 */
function isPriceBelow(price: number, threshold: number | undefined): boolean {
  if (threshold === undefined) return false;
  return price < threshold;
}

/**
 * Checks if a price is above a threshold
 */
function isPriceAbove(price: number, threshold: number | undefined): boolean {
  if (threshold === undefined) return false;
  return price > threshold;
}

/**
 * Generates trading recommendation based on current price and action zones
 */
function enrichReasonWithTrend(
  baseReason: string,
  baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
  historyPoints?: PriceHistoryPoint[],
  recommendation?: TradingRecommendation
): { reason: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const trend = historyPoints?.length ? priceHistoryTrendContext(historyPoints) : null;
  if (!trend) {
    return { reason: baseReason, confidence: baseConfidence };
  }

  let reason = `${baseReason}. ${trend}`;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = baseConfidence;

  const sorted = [...historyPoints!].sort((a, b) =>
    a.tradingDate.localeCompare(b.tradingDate)
  );
  const trendingDown =
    sorted.length >= 2 &&
    sorted[sorted.length - 1].lastPrice < sorted[0].lastPrice;
  const trendingUp =
    sorted.length >= 2 &&
    sorted[sorted.length - 1].lastPrice > sorted[0].lastPrice;

  if (
    (recommendation === 'BUY_NEW' || recommendation === 'ADD_ACCUMULATE') &&
    trendingDown
  ) {
    confidence = 'HIGH';
  } else if (
    (recommendation === 'TRIM' || recommendation === 'STRONG_STOP_TAKE_PROFIT') &&
    trendingUp
  ) {
    confidence = 'HIGH';
  } else if (recommendation === 'HOLD') {
    confidence = 'LOW';
  }

  return { reason, confidence };
}

export function generateRecommendation(
  holding: SecurityHolding,
  actionRange: ActionPriceRange,
  priceHistory?: PriceHistoryPoint[]
): SecurityRecommendation | null {
  if (!holding.currentPrice) {
    return null;
  }

  const currentPrice = holding.currentPrice;
  
  // Parse all price zones
  const accumulateSlowlyRange = actionRange.accumulateSlowly 
    ? parsePriceRange(actionRange.accumulateSlowly) 
    : null;
  const strongAddZoneRange = actionRange.strongAddZone 
    ? parsePriceRange(actionRange.strongAddZone) 
    : null;
  const pauseBuysRange = actionRange.pauseBuys 
    ? parsePriceRange(actionRange.pauseBuys) 
    : null;
  const trimSmallPortionRange = actionRange.trimSmallPortion 
    ? parsePriceRange(actionRange.trimSmallPortion) 
    : null;
  const reEvaluateThreshold = actionRange.reEvaluateIfWeak 
    ? parsePriceRange(actionRange.reEvaluateIfWeak)?.max 
    : undefined;

  let recommendation: TradingRecommendation = 'HOLD';
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let reason = '';

  // Priority order for recommendations (most urgent first)
  
  // 1. EXIT - Price below trailing stop or re-evaluate threshold
  if (actionRange.trailingStop && currentPrice < actionRange.trailingStop) {
    recommendation = 'EXIT';
    confidence = 'HIGH';
    reason = `Price (${currentPrice.toFixed(2)}) is below trailing stop (${actionRange.trailingStop.toFixed(2)})`;
  } else if (reEvaluateThreshold && currentPrice < reEvaluateThreshold) {
    recommendation = 'EXIT';
    confidence = 'HIGH';
    reason = `Price (${currentPrice.toFixed(2)}) is below re-evaluate threshold (${reEvaluateThreshold.toFixed(2)})`;
  }
  // 2. STRONG_STOP_TAKE_PROFIT - Price above trim zone
  else if (trimSmallPortionRange && isPriceInRange(currentPrice, trimSmallPortionRange)) {
    recommendation = 'STRONG_STOP_TAKE_PROFIT';
    confidence = 'HIGH';
    reason = `Price (${currentPrice.toFixed(2)}) is in trim zone (${actionRange.trimSmallPortion}) - consider taking profits`;
  }
  // 3. TRIM - Price in pause buys zone (might want to trim)
  else if (pauseBuysRange && isPriceInRange(currentPrice, pauseBuysRange)) {
    recommendation = 'TRIM';
    confidence = 'MEDIUM';
    reason = `Price (${currentPrice.toFixed(2)}) is in pause buys zone (${actionRange.pauseBuys}) - consider trimming`;
  }
  // 4. BUY_NEW - Price in strong add zone (best buying opportunity)
  else if (strongAddZoneRange && isPriceInRange(currentPrice, strongAddZoneRange)) {
    recommendation = 'BUY_NEW';
    confidence = 'HIGH';
    reason = `Price (${currentPrice.toFixed(2)}) is in strong add zone (${actionRange.strongAddZone}) - excellent buying opportunity`;
  }
  // 5. ADD_ACCUMULATE - Price in accumulate slowly zone
  else if (accumulateSlowlyRange && isPriceInRange(currentPrice, accumulateSlowlyRange)) {
    recommendation = 'ADD_ACCUMULATE';
    confidence = 'MEDIUM';
    reason = `Price (${currentPrice.toFixed(2)}) is in accumulate slowly zone (${actionRange.accumulateSlowly}) - good time to add`;
  }
  // 6. HOLD - Default if price is between zones or no zones defined
  else {
    recommendation = 'HOLD';
    confidence = 'LOW';
    reason = `Price (${currentPrice.toFixed(2)}) is in normal range - hold position`;
    
    // If we have unrealized gains/losses, add context
    if (holding.unrealizedGainLoss !== undefined) {
      if (holding.unrealizedGainLoss > 0) {
        reason += ` (Unrealized gain: ${holding.unrealizedGainLossPercent?.toFixed(2)}%)`;
      } else if (holding.unrealizedGainLoss < 0) {
        reason += ` (Unrealized loss: ${holding.unrealizedGainLossPercent?.toFixed(2)}%)`;
      }
    }
  }

  const enriched = enrichReasonWithTrend(reason, confidence, priceHistory, recommendation);

  return {
    security: holding.security,
    recommendation,
    confidence: enriched.confidence,
    reason: enriched.reason,
    currentPrice,
    targetZones: {
      accumulateSlowly: accumulateSlowlyRange || undefined,
      strongAddZone: strongAddZoneRange || undefined,
      reEvaluateIfWeak: reEvaluateThreshold,
      pauseBuys: pauseBuysRange || undefined,
      trimSmallPortion: trimSmallPortionRange?.min || undefined,
      trailingStop: actionRange.trailingStop,
    },
  };
}

/**
 * Generates recommendations for all holdings that have action ranges
 */
export function generateAllRecommendations(
  holdings: Record<string, SecurityHolding>,
  actionRanges: Record<string, ActionPriceRange>,
  priceHistoryBySecurity: Record<string, PriceHistoryPoint[]> = {}
): Record<string, SecurityRecommendation> {
  const recommendations: Record<string, SecurityRecommendation> = {};

  for (const security in holdings) {
    const holding = holdings[security];
    const actionRange = actionRanges[security];
    
    if (actionRange && holding.currentPrice) {
      const recommendation = generateRecommendation(
        holding,
        actionRange,
        priceHistoryBySecurity[security]
      );
      if (recommendation) {
        recommendations[security] = recommendation;
      }
    }
  }

  return recommendations;
}
