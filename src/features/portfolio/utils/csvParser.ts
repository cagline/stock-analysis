import type { Order, ActionPriceRange } from '../types';

/**
 * Parses a CSV file from ATrad Order Tracker
 * Handles the specific format with headers and data rows
 */
export function parseOrderTrackerCSV(csvText: string): Order[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 3) {
    throw new Error('Invalid CSV format: Expected at least 3 lines (title, empty, header)');
  }

  // Find the header row (usually line 2, index 2)
  // Look for line containing "Security,Side,Order Qty"
  let headerIndex = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].includes('Security') && lines[i].includes('Side') && lines[i].includes('Order Qty')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Invalid CSV format: Could not find header row');
  }

  const headerLine = lines[headerIndex];
  const headers = parseCSVLine(headerLine);

  // Find column indices
  const securityIndex = headers.findIndex(h => h.toLowerCase().includes('security'));
  const sideIndex = headers.findIndex(h => h.toLowerCase().includes('side'));
  const orderQtyIndex = headers.findIndex(h => h.toLowerCase().includes('order qty'));
  const orderPriceIndex = headers.findIndex(h => h.toLowerCase().includes('order price'));
  const orderValueIndex = headers.findIndex(h => h.toLowerCase().includes('order value'));
  const orderStatusIndex = headers.findIndex(h => h.toLowerCase().includes('order status'));
  const remainingQtyIndex = headers.findIndex(h => h.toLowerCase().includes('remaining qty'));
  const filledQtyIndex = headers.findIndex(h => h.toLowerCase().includes('filled qty'));
  const orderDateTimeIndex = headers.findIndex(h => h.toLowerCase().includes('order date and time'));
  const exchangeOrderIdIndex = headers.findIndex(h => h.toLowerCase().includes('exchange order id'));
  const executionIdIndex = headers.findIndex(h => h.toLowerCase().includes('execution id'));

  if (securityIndex === -1 || sideIndex === -1 || orderQtyIndex === -1 || orderPriceIndex === -1) {
    throw new Error('Invalid CSV format: Missing required columns');
  }

  const orders: Order[] = [];
  const processedExchangeOrderIds = new Set<string>();

  // Process data rows (starting after header)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const values = parseCSVLine(line);
    
    if (values.length < Math.max(securityIndex, sideIndex, orderQtyIndex, orderPriceIndex) + 1) {
      continue; // Skip incomplete rows
    }

    const security = values[securityIndex]?.trim();
    const side = values[sideIndex]?.trim().toUpperCase();
    const orderStatus = values[orderStatusIndex]?.trim() || '';
    const remainingQty = parseNumber(values[remainingQtyIndex] || '0');
    const filledQty = parseNumber(values[filledQtyIndex] || '0');
    const exchangeOrderId = values[exchangeOrderIdIndex]?.trim() || '';

    // Only process FILLED orders
    if (orderStatus !== 'FILLED') {
      continue;
    }

    // For orders with same Exchange Order Id, only process the one with Remaining Qty = 0
    if (exchangeOrderId) {
      if (processedExchangeOrderIds.has(exchangeOrderId)) {
        continue; // Already processed this exchange order
      }
      if (remainingQty !== 0) {
        continue; // Skip partial fills, wait for the complete fill
      }
      processedExchangeOrderIds.add(exchangeOrderId);
    }

    if (!security || (side !== 'BUY' && side !== 'SELL')) {
      continue;
    }

    const orderQty = parseNumber(values[orderQtyIndex] || '0');
    const orderPrice = parseNumber(values[orderPriceIndex] || '0');
    const orderValue = parseNumber(values[orderValueIndex] || '0');
    const orderDateTime = values[orderDateTimeIndex]?.trim() || '';
    const executionId = executionIdIndex >= 0 ? values[executionIdIndex]?.trim() || undefined : undefined;

    // Parse date and time
    let orderDate = '';
    let orderTime = '';
    if (orderDateTime) {
      const dateTimeMatch = orderDateTime.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (dateTimeMatch) {
        orderDate = dateTimeMatch[1];
        orderTime = dateTimeMatch[2];
      }
    }

    const order: Order = {
      id: executionId ?? `${exchangeOrderId || `order-${i}`}-${Date.now()}-${Math.random()}`,
      security,
      side: side as 'BUY' | 'SELL',
      orderQty,
      orderPrice,
      orderValue: orderValue || orderQty * orderPrice,
      orderDate,
      orderTime,
      orderDateTime,
      exchangeOrderId,
      executionId,
      filledQty: filledQty || orderQty,
      remainingQty,
      orderStatus,
    };

    orders.push(order);
  }

  return orders;
}

/**
 * Parses a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parses a number from string, handling commas and other formatting
 */
function parseNumber(value: string): number {
  if (!value) return 0;
  // Remove commas and other formatting
  const cleaned = value.toString().replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * One row from an ATrad Watchlist CSV export.
 */
export type WatchlistRow = {
  security: string;
  lastPrice: number;
  bidPrice?: number;
  askPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  turnover?: number;
  changeAmount?: number;
  changePercent?: number;
  time?: string;
};

function findWatchlistHeader(lines: string[]): { headerIndex: number; headers: string[] } {
  let headerIndex = -1;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (lines[i].includes('Security') && lines[i].includes('Last')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Invalid Watchlist CSV format: Could not find header row with Security and Last columns');
  }

  return { headerIndex, headers: parseCSVLine(lines[headerIndex]) };
}

function findColumnIndex(headers: string[], ...patterns: string[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(pattern.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parses a Watchlist CSV file from ATrad — full row data for history storage.
 */
export function parseWatchlistRows(csvText: string): WatchlistRow[] {
  const lines = csvText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('Invalid Watchlist CSV format: Expected at least header and data rows');
  }

  const { headerIndex, headers } = findWatchlistHeader(lines);

  const securityIndex = findColumnIndex(headers, 'security');
  const lastPriceIndex = findColumnIndex(headers, 'last');
  const bidPriceIndex = findColumnIndex(headers, 'bid price');
  const askPriceIndex = findColumnIndex(headers, 'ask price');
  const highIndex = findColumnIndex(headers, 'high');
  const lowIndex = findColumnIndex(headers, 'low');
  const volumeIndex = findColumnIndex(headers, 'volume');
  const turnoverIndex = findColumnIndex(headers, 'turnover');
  const changeIndex = findColumnIndex(headers, 'change');
  const changePercentIndex = headers.findIndex(
    (h) => h.toLowerCase().includes('% change') || h.toLowerCase().includes('change %')
  );
  const timeIndex = findColumnIndex(headers, 'time');

  if (securityIndex === -1 || lastPriceIndex === -1) {
    throw new Error('Invalid Watchlist CSV format: Missing Security or Last columns');
  }

  const rows: WatchlistRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const values = parseCSVLine(line);
    if (values.length < Math.max(securityIndex, lastPriceIndex) + 1) continue;

    const security = values[securityIndex]?.trim();
    const lastPrice = parseNumber(values[lastPriceIndex] || '0');
    if (!security || lastPrice <= 0) continue;

    const row: WatchlistRow = { security, lastPrice };

    if (bidPriceIndex >= 0) {
      const v = parseNumber(values[bidPriceIndex] || '0');
      if (v > 0) row.bidPrice = v;
    }
    if (askPriceIndex >= 0) {
      const v = parseNumber(values[askPriceIndex] || '0');
      if (v > 0) row.askPrice = v;
    }
    if (highIndex >= 0) {
      const v = parseNumber(values[highIndex] || '0');
      if (v > 0) row.highPrice = v;
    }
    if (lowIndex >= 0) {
      const v = parseNumber(values[lowIndex] || '0');
      if (v > 0) row.lowPrice = v;
    }
    if (volumeIndex >= 0) {
      const v = parseNumber(values[volumeIndex] || '0');
      if (v > 0) row.volume = v;
    }
    if (turnoverIndex >= 0) {
      const v = parseNumber(values[turnoverIndex] || '0');
      if (v > 0) row.turnover = v;
    }
    if (changeIndex >= 0) {
      const raw = values[changeIndex]?.trim();
      if (raw) row.changeAmount = parseNumber(raw);
    }
    if (changePercentIndex >= 0) {
      const raw = values[changePercentIndex]?.replace(/%/g, '').trim();
      if (raw) row.changePercent = parseNumber(raw);
    }
    if (timeIndex >= 0) {
      const t = values[timeIndex]?.trim();
      if (t) row.time = t;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Parses a Watchlist CSV file from ATrad
 * Extracts Security -> Last Price mapping
 */
export function parseWatchlistCSV(csvText: string): Record<string, number> {
  const rows = parseWatchlistRows(csvText);
  const priceMap: Record<string, number> = {};
  for (const row of rows) {
    priceMap[row.security] = row.lastPrice;
  }
  return priceMap;
}

/**
 * One row from an ATrad Portfolio CSV/XLSX export.
 */
export type PortfolioRow = {
  security: string;
  quantity?: number;
  clearedBalance?: number;
  availableBalance?: number;
  unsettledBuy?: number;
  unsettledSell?: number;
  holdingPctQty?: number;
  avgPrice?: number;
  besPrice?: number;
  totalCost?: number;
  tradedPrice?: number;
  marketValue?: number;
  holdingPctMarketValue?: number;
  salesCommission: number;
  salesProceeds: number;
  unrealizedGainLoss?: number;
  unrealizedGainLossPct?: number;
  unrealizedTodayGainLoss?: number;
};

function findPortfolioHeader(lines: string[]): { headerIndex: number; headers: string[] } {
  let headerIndex = -1;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (
      lines[i].includes('Security') &&
      lines[i].includes('Sales Commission') &&
      lines[i].includes('Sales Proceeds')
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Invalid Portfolio format: Could not find header row');
  }

  return { headerIndex, headers: parseCSVLine(lines[headerIndex]) };
}

function portfolioCol(headers: string[], ...patterns: string[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(pattern.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function optionalField(values: string[], index: number): number | undefined {
  if (index < 0) return undefined;
  const v = parseNumber(values[index] || '0');
  return Number.isFinite(v) ? v : undefined;
}

/**
 * Parses a Portfolio CSV text (from .csv or converted .xlsx) — full row data.
 */
export function parsePortfolioRows(csvText: string): PortfolioRow[] {
  const lines = csvText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  if (lines.length < 3) {
    throw new Error('Invalid Portfolio format: Expected at least header and data rows');
  }

  const { headerIndex, headers } = findPortfolioHeader(lines);

  const securityIndex = portfolioCol(headers, 'security');
  const quantityIndex = portfolioCol(headers, 'quantity');
  const clearedIndex = portfolioCol(headers, 'cleared balance');
  const availableIndex = portfolioCol(headers, 'available balance');
  const unsettledBuyIndex = portfolioCol(headers, 'unsettled buy');
  const unsettledSellIndex = portfolioCol(headers, 'unsettled sell');
  const holdingPctQtyIndex = portfolioCol(headers, 'holding % (quantity)');
  const avgPriceIndex = portfolioCol(headers, 'avg price');
  const besPriceIndex = portfolioCol(headers, 'b.e.s price', 'bes price');
  const totalCostIndex = portfolioCol(headers, 'total cost');
  const tradedPriceIndex = portfolioCol(headers, 'traded price');
  const marketValueIndex = portfolioCol(headers, 'market value');
  const holdingPctMvIndex = portfolioCol(headers, 'holding % (market value)');
  const salesCommissionIndex = portfolioCol(headers, 'sales commission');
  const salesProceedsIndex = portfolioCol(headers, 'sales proceeds');
  const unrealizedIndex = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('unrealized gain') &&
      !h.toLowerCase().includes('%') &&
      !h.toLowerCase().includes('today')
  );
  const unrealizedPctIndex = headers.findIndex(
    (h) =>
      h.toLowerCase().includes('unrealized gain') && h.toLowerCase().includes('%')
  );
  const unrealizedTodayIndex = portfolioCol(headers, 'unr today');

  if (securityIndex === -1 || salesCommissionIndex === -1 || salesProceedsIndex === -1) {
    throw new Error('Invalid Portfolio format: Missing required columns');
  }

  const rows: PortfolioRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    if (line.toUpperCase().startsWith('TOTAL')) continue;

    const values = parseCSVLine(line);
    if (values.length < Math.max(securityIndex, salesCommissionIndex, salesProceedsIndex) + 1) {
      continue;
    }

    const security = values[securityIndex]?.trim();
    if (!security) continue;

    const salesCommission = parseNumber(values[salesCommissionIndex] || '0');
    const salesProceeds = parseNumber(values[salesProceedsIndex] || '0');
    const quantity = optionalField(values, quantityIndex);
    const marketValue = optionalField(values, marketValueIndex);

    if (
      (quantity == null || quantity <= 0) &&
      (marketValue == null || marketValue <= 0) &&
      salesCommission <= 0 &&
      salesProceeds <= 0
    ) {
      continue;
    }

    const row: PortfolioRow = {
      security,
      salesCommission,
      salesProceeds,
    };

    if (quantity != null) row.quantity = quantity;
    const cleared = optionalField(values, clearedIndex);
    if (cleared != null) row.clearedBalance = cleared;
    const available = optionalField(values, availableIndex);
    if (available != null) row.availableBalance = available;
    const ub = optionalField(values, unsettledBuyIndex);
    if (ub != null) row.unsettledBuy = ub;
    const us = optionalField(values, unsettledSellIndex);
    if (us != null) row.unsettledSell = us;
    const hpq = optionalField(values, holdingPctQtyIndex);
    if (hpq != null) row.holdingPctQty = hpq;
    const avg = optionalField(values, avgPriceIndex);
    if (avg != null) row.avgPrice = avg;
    const bes = optionalField(values, besPriceIndex);
    if (bes != null) row.besPrice = bes;
    const tc = optionalField(values, totalCostIndex);
    if (tc != null) row.totalCost = tc;
    const tp = optionalField(values, tradedPriceIndex);
    if (tp != null) row.tradedPrice = tp;
    const mv = optionalField(values, marketValueIndex);
    if (mv != null) row.marketValue = mv;
    const hpmv = optionalField(values, holdingPctMvIndex);
    if (hpmv != null) row.holdingPctMarketValue = hpmv;
    if (unrealizedIndex >= 0) {
      row.unrealizedGainLoss = parseNumber(values[unrealizedIndex] || '0');
    }
    if (unrealizedPctIndex >= 0) {
      row.unrealizedGainLossPct = parseNumber(values[unrealizedPctIndex] || '0');
    }
    if (unrealizedTodayIndex >= 0) {
      row.unrealizedTodayGainLoss = parseNumber(values[unrealizedTodayIndex] || '0');
    }

    rows.push(row);
  }

  return rows;
}

/** Build adjustment map used by lot tracker / current snapshot. */
export function portfolioRowsToAdjustments(
  rows: PortfolioRow[]
): Record<string, { salesCommission: number; salesProceeds: number; unrealizedGainLoss: number }> {
  const portfolioData: Record<
    string,
    { salesCommission: number; salesProceeds: number; unrealizedGainLoss: number }
  > = {};
  for (const row of rows) {
    if (row.salesCommission > 0 || row.salesProceeds > 0) {
      portfolioData[row.security] = {
        salesCommission: row.salesCommission,
        salesProceeds: row.salesProceeds,
        unrealizedGainLoss: row.unrealizedGainLoss ?? 0,
      };
    }
  }
  return portfolioData;
}

/**
 * Parses a Portfolio CSV file from ATrad
 * Extracts Sales Commission, Sales Proceeds, and Unrealized Gain/Loss per security
 */
export function parsePortfolioCSV(csvText: string): Record<string, {
  salesCommission: number;
  salesProceeds: number;
  unrealizedGainLoss: number;
}> {
  return portfolioRowsToAdjustments(parsePortfolioRows(csvText));
}

/**
 * Parses Action Price Ranges CSV file
 * Format: Company Code,Quantity,Avg Price,B.E.S Price,Last,Change,% Change,Accumulate Slowly,Strong Add Zone,Re-evaluate if Market Weak,Pause Buys,Trim Small Portion,Investment_Percentage,Time,Trailing Stop (SELL if below)
 */
export function parseActionPriceRangesCSV(csvText: string): Record<string, ActionPriceRange> {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 2) {
    throw new Error('Invalid CSV format: Expected at least header and one data row');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Find column indices
  const companyCodeIndex = headers.findIndex(h => h.toLowerCase().includes('company code') || h.toLowerCase().includes('security'));
  const quantityIndex = headers.findIndex(h => h.toLowerCase().includes('quantity'));
  const avgPriceIndex = headers.findIndex(h => h.toLowerCase().includes('avg price') || h.toLowerCase().includes('average price'));
  const breakEvenSellPriceIndex = headers.findIndex(h => h.toLowerCase().includes('b.e.s') || h.toLowerCase().includes('break even'));
  const lastIndex = headers.findIndex(h => h.toLowerCase().includes('last'));
  const changeIndex = headers.findIndex(h => h.toLowerCase().includes('change') && !h.toLowerCase().includes('%'));
  const changePercentIndex = headers.findIndex(h => h.toLowerCase().includes('% change') || (h.toLowerCase().includes('change') && h.toLowerCase().includes('%')));
  const accumulateSlowlyIndex = headers.findIndex(h => h.toLowerCase().includes('accumulate slowly'));
  const strongAddZoneIndex = headers.findIndex(h => h.toLowerCase().includes('strong add zone'));
  const reEvaluateIndex = headers.findIndex(h => h.toLowerCase().includes('re-evaluate') || h.toLowerCase().includes('reevaluate'));
  const pauseBuysIndex = headers.findIndex(h => h.toLowerCase().includes('pause buys'));
  const trimSmallPortionIndex = headers.findIndex(h => h.toLowerCase().includes('trim small portion'));
  const investmentPercentageIndex = headers.findIndex(h => h.toLowerCase().includes('investment_percentage') || h.toLowerCase().includes('investment percentage'));
  const trailingStopIndex = headers.findIndex(h => h.toLowerCase().includes('trailing stop'));

  if (companyCodeIndex === -1 || quantityIndex === -1 || avgPriceIndex === -1) {
    throw new Error('Invalid CSV format: Missing required columns (Company Code, Quantity, Avg Price)');
  }

  const actionRanges: Record<string, ActionPriceRange> = {};

  // Process data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < 3) continue; // Skip empty or invalid rows

    const security = values[companyCodeIndex]?.trim();
    if (!security) continue;

    const quantity = parseNumber(values[quantityIndex] || '0');
    const avgPrice = parseNumber(values[avgPriceIndex] || '0');
    const breakEvenSellPrice = parseNumber(values[breakEvenSellPriceIndex] || avgPrice.toString());
    const lastPrice = values[lastIndex] ? parseNumber(values[lastIndex]) : undefined;
    const change = values[changeIndex] ? parseNumber(values[changeIndex]) : undefined;
    const changePercent = values[changePercentIndex] ? parseNumber(values[changePercentIndex]) : undefined;
    const accumulateSlowly = values[accumulateSlowlyIndex]?.trim() || undefined;
    const strongAddZone = values[strongAddZoneIndex]?.trim() || undefined;
    const reEvaluateIfWeak = values[reEvaluateIndex]?.trim() || undefined;
    const pauseBuys = values[pauseBuysIndex]?.trim() || undefined;
    const trimSmallPortion = values[trimSmallPortionIndex]?.trim() || undefined;
    const investmentPercentage = values[investmentPercentageIndex] 
      ? parseFloat(values[investmentPercentageIndex].replace('%', '').trim()) 
      : undefined;
    const trailingStop = values[trailingStopIndex] ? parseNumber(values[trailingStopIndex]) : undefined;

    actionRanges[security] = {
      security,
      quantity,
      avgPrice,
      breakEvenSellPrice,
      lastPrice,
      change,
      changePercent,
      accumulateSlowly,
      strongAddZone,
      reEvaluateIfWeak,
      pauseBuys,
      trimSmallPortion,
      investmentPercentage,
      trailingStop,
    };
  }

  return actionRanges;
}