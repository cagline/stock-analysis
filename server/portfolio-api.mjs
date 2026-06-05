import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const PORT = Number(process.env.PORTFOLIO_API_PORT || 3002);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and run: npm run docker:db && npm run db:migrate');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function pgErrorResponse(err) {
  const code = err?.code;
  const msg = err instanceof Error ? err.message : String(err);
  const hintByCode = {
    '42P01':
      'Tables are missing. From the repo root run: npm run docker:db && npm run db:migrate',
    '28P01':
      'PostgreSQL auth failed. Ensure DATABASE_URL in .env matches POSTGRES_USER and POSTGRES_PASSWORD in docker-compose.',
    '3D000':
      'The database name in DATABASE_URL does not exist. Check POSTGRES_DB and your connection string.',
  };
  let hint = hintByCode[code];
  if (!hint && /ECONNREFUSED/i.test(msg)) {
    hint =
      'Cannot connect to Postgres. Start the database (npm run docker:db) or fix DATABASE_URL host/port.';
  }
  return { error: msg, code: code || undefined, hint };
}

/** YYYY-MM-DD for Postgres; derives from orderDateTime when orderDate is empty. */
function orderDateForPg(o) {
  const s = (o.orderDate && String(o.orderDate).trim()) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (o.orderDateTime) {
    const m = String(o.orderDateTime).match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  throw new Error(
    `Order ${o.id ?? '?'}: invalid orderDate "${s}" (expected YYYY-MM-DD). Re-import Order Tracker CSV or fix stored rows.`
  );
}

function splitDateForPg(s) {
  const t = (s && String(s).trim()) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  throw new Error(`Invalid splitDate "${t}" (expected YYYY-MM-DD).`);
}

function tradingDateForPg(s) {
  const t = (s && String(s).trim()) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  throw new Error(`Invalid tradingDate "${t}" (expected YYYY-MM-DD).`);
}

function optionalNum(x) {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function rowToPortfolioSnapshot(r) {
  const sd = r.snapshot_date;
  const snapshotDate =
    sd instanceof Date ? sd.toISOString().slice(0, 10) : String(sd).slice(0, 10);
  return {
    security: r.security,
    snapshotDate,
    quantity: r.quantity != null ? Number(r.quantity) : undefined,
    clearedBalance: r.cleared_balance != null ? Number(r.cleared_balance) : undefined,
    availableBalance: r.available_balance != null ? Number(r.available_balance) : undefined,
    unsettledBuy: r.unsettled_buy != null ? Number(r.unsettled_buy) : undefined,
    unsettledSell: r.unsettled_sell != null ? Number(r.unsettled_sell) : undefined,
    holdingPctQty: r.holding_pct_qty != null ? Number(r.holding_pct_qty) : undefined,
    avgPrice: r.avg_price != null ? Number(r.avg_price) : undefined,
    besPrice: r.bes_price != null ? Number(r.bes_price) : undefined,
    totalCost: r.total_cost != null ? Number(r.total_cost) : undefined,
    tradedPrice: r.traded_price != null ? Number(r.traded_price) : undefined,
    marketValue: r.market_value != null ? Number(r.market_value) : undefined,
    holdingPctMarketValue:
      r.holding_pct_market_value != null ? Number(r.holding_pct_market_value) : undefined,
    salesCommission: Number(r.sales_commission),
    salesProceeds: Number(r.sales_proceeds),
    unrealizedGainLoss:
      r.unrealized_gain_loss != null ? Number(r.unrealized_gain_loss) : undefined,
    unrealizedGainLossPct:
      r.unrealized_gain_loss_pct != null ? Number(r.unrealized_gain_loss_pct) : undefined,
    unrealizedTodayGainLoss:
      r.unrealized_today_gain_loss != null ? Number(r.unrealized_today_gain_loss) : undefined,
    observedAt: r.observed_at ? new Date(r.observed_at).toISOString() : undefined,
    sourceFile: r.source_file || undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

function snapshotDateForPg(s) {
  return tradingDateForPg(s);
}

function rowToPriceHistory(r) {
  const td = r.trading_date;
  const tradingDate =
    td instanceof Date ? td.toISOString().slice(0, 10) : String(td).slice(0, 10);
  return {
    security: r.security,
    tradingDate,
    lastPrice: Number(r.last_price),
    bidPrice: r.bid_price != null ? Number(r.bid_price) : undefined,
    askPrice: r.ask_price != null ? Number(r.ask_price) : undefined,
    highPrice: r.high_price != null ? Number(r.high_price) : undefined,
    lowPrice: r.low_price != null ? Number(r.low_price) : undefined,
    volume: r.volume != null ? Number(r.volume) : undefined,
    turnover: r.turnover != null ? Number(r.turnover) : undefined,
    changeAmount: r.change_amount != null ? Number(r.change_amount) : undefined,
    changePercent: r.change_percent != null ? Number(r.change_percent) : undefined,
    observedAt: r.observed_at ? new Date(r.observed_at).toISOString() : undefined,
    sourceFile: r.source_file || undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

function num(x, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

function dedupeKey(o) {
  return o.executionId
    ? o.executionId
    : `${o.exchangeOrderId || o.id}|${o.orderDate}|${o.orderTime || ''}`;
}

function rowToOrder(row) {
  const od = row.order_date;
  const orderDate =
    od instanceof Date ? od.toISOString().slice(0, 10) : String(od).slice(0, 10);

  let orderDateTime = '';
  if (row.order_datetime) {
    const dt = new Date(row.order_datetime);
    if (!Number.isNaN(dt.getTime())) orderDateTime = dt.toISOString();
  }

  return {
    id: row.client_order_id,
    security: row.security,
    side: row.side,
    orderQty: Number(row.order_qty),
    orderPrice: Number(row.order_price),
    orderValue: Number(row.order_value),
    orderDate,
    orderTime: row.order_time ?? '',
    orderDateTime,
    exchangeOrderId: row.exchange_order_id ?? '',
    executionId: row.execution_id || undefined,
    filledQty: Number(row.filled_qty),
    remainingQty: Number(row.remaining_qty),
    orderStatus: row.order_status ?? '',
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, database: 'up' });
  } catch (e) {
    console.error('[health/db]', e);
    res.status(500).json({ ok: false, ...pgErrorResponse(e) });
  }
});

app.get('/api/portfolio/bootstrap', async (_req, res) => {
  try {
    const [orders, splits, prices, ranges, adjustments] = await Promise.all([
      pool.query(
        `SELECT * FROM portfolio_orders ORDER BY order_date, order_time, security, dedupe_key`
      ),
      pool.query(`SELECT * FROM stock_splits ORDER BY split_date, security`),
      pool.query(`SELECT * FROM security_prices ORDER BY security`),
      pool.query(`SELECT * FROM action_price_ranges ORDER BY security`),
      pool.query(`SELECT * FROM portfolio_adjustments ORDER BY security`),
    ]);

    const currentPrices = {};
    for (const r of prices.rows) {
      currentPrices[r.security] = Number(r.last_price);
    }

    const actionPriceRanges = {};
    for (const r of ranges.rows) {
      actionPriceRanges[r.security] = r.data;
    }

    const portfolioAdjustments = {};
    for (const r of adjustments.rows) {
      portfolioAdjustments[r.security] = {
        salesCommission: Number(r.sales_commission),
        salesProceeds: Number(r.sales_proceeds),
        unrealizedGainLoss: Number(r.unrealized_gain_loss),
      };
    }

    res.json({
      orders: orders.rows.map(rowToOrder),
      stockSplits: splits.rows.map((r) => ({
        id: r.id,
        security: r.security,
        splitDate:
          r.split_date instanceof Date
            ? r.split_date.toISOString().slice(0, 10)
            : String(r.split_date).slice(0, 10),
        splitDateTime: r.split_datetime,
        ratio: Number(r.ratio),
      })),
      currentPrices,
      actionPriceRanges,
      portfolioAdjustments,
    });
  } catch (e) {
    console.error('[bootstrap]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.put('/api/portfolio/orders', async (req, res) => {
  const orders = req.body;
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'Body must be a JSON array of orders' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM portfolio_orders');
    for (const o of orders) {
      const dk = dedupeKey(o);
      let orderDate;
      try {
        orderDate = orderDateForPg(o);
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      let orderDatetime = null;
      if (o.orderDateTime) {
        const d = new Date(o.orderDateTime);
        if (!Number.isNaN(d.getTime())) orderDatetime = d.toISOString();
      }
      const side = String(o.side || '').toUpperCase();
      if (side !== 'BUY' && side !== 'SELL') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Order ${o.id}: side must be BUY or SELL (got ${o.side})`,
        });
      }
      await client.query(
        `INSERT INTO portfolio_orders (
          client_order_id, dedupe_key, security, side, order_qty, order_price, order_value,
          order_date, order_time, order_datetime, exchange_order_id, execution_id,
          filled_qty, remaining_qty, order_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,$15)`,
        [
          String(o.id),
          dk,
          String(o.security ?? ''),
          side,
          num(o.orderQty),
          num(o.orderPrice),
          num(o.orderValue),
          orderDate,
          o.orderTime ?? '',
          orderDatetime,
          o.exchangeOrderId ?? '',
          o.executionId || null,
          num(o.filledQty),
          num(o.remainingQty),
          o.orderStatus ?? '',
        ]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[PUT orders]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.put('/api/portfolio/stock-splits', async (req, res) => {
  const splits = req.body;
  if (!Array.isArray(splits)) {
    return res.status(400).json({ error: 'Body must be a JSON array' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM stock_splits');
    for (const s of splits) {
      let sd;
      try {
        sd = splitDateForPg(s.splitDate);
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await client.query(
        `INSERT INTO stock_splits (id, security, split_date, split_datetime, ratio)
         VALUES ($1,$2,$3::date,$4,$5)`,
        [s.id, s.security, sd, s.splitDateTime, num(s.ratio, 1)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[PUT stock-splits]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.put('/api/portfolio/prices', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a JSON object (security -> price)' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM security_prices');
    for (const [security, price] of Object.entries(body)) {
      await client.query(`INSERT INTO security_prices (security, last_price) VALUES ($1, $2)`, [
        security,
        num(price),
      ]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[PUT prices]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.put('/api/portfolio/action-ranges', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a JSON object' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM action_price_ranges');
    for (const [security, data] of Object.entries(body)) {
      await client.query(`INSERT INTO action_price_ranges (security, data) VALUES ($1, $2::jsonb)`, [
        security,
        JSON.stringify(data ?? {}),
      ]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[PUT action-ranges]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.get('/api/portfolio/prices/history/securities', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT security FROM security_prices_history ORDER BY security`
    );
    res.json({ securities: result.rows.map((r) => r.security) });
  } catch (e) {
    console.error('[GET prices/history/securities]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.get('/api/portfolio/prices/history', async (req, res) => {
  try {
    const { security, from, to, limit } = req.query;
    const conditions = [];
    const params = [];

    if (security && String(security).trim()) {
      params.push(String(security).trim());
      conditions.push(`security = $${params.length}`);
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
      params.push(String(from));
      conditions.push(`trading_date >= $${params.length}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) {
      params.push(String(to));
      conditions.push(`trading_date <= $${params.length}::date`);
    }

    let sql = `SELECT * FROM security_prices_history`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY trading_date DESC, security`;

    const limitNum = limit ? Number(limit) : 5000;
    if (Number.isFinite(limitNum) && limitNum > 0) {
      params.push(Math.min(limitNum, 10000));
      sql += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(sql, params);
    res.json({ rows: result.rows.map(rowToPriceHistory) });
  } catch (e) {
    console.error('[GET prices/history]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.post('/api/portfolio/prices/history', async (req, res) => {
  const { tradingDate, sourceFile, rows } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Body must include a non-empty rows array' });
  }
  let td;
  try {
    td = tradingDateForPg(tradingDate);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const observedAt = new Date().toISOString();
  const src = sourceFile ? String(sourceFile) : null;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    let upserted = 0;
    for (const row of rows) {
      const security = String(row.security ?? '').trim();
      const lastPrice = num(row.lastPrice);
      if (!security || lastPrice <= 0) continue;

      await client.query(
        `INSERT INTO security_prices_history (
          security, trading_date, last_price, bid_price, ask_price,
          high_price, low_price, volume, turnover, change_amount, change_percent,
          observed_at, source_file
        ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (security, trading_date) DO UPDATE SET
          last_price = EXCLUDED.last_price,
          bid_price = EXCLUDED.bid_price,
          ask_price = EXCLUDED.ask_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          volume = EXCLUDED.volume,
          turnover = EXCLUDED.turnover,
          change_amount = EXCLUDED.change_amount,
          change_percent = EXCLUDED.change_percent,
          observed_at = EXCLUDED.observed_at,
          source_file = EXCLUDED.source_file,
          updated_at = now()`,
        [
          security,
          td,
          lastPrice,
          optionalNum(row.bidPrice),
          optionalNum(row.askPrice),
          optionalNum(row.highPrice),
          optionalNum(row.lowPrice),
          optionalNum(row.volume),
          optionalNum(row.turnover),
          optionalNum(row.changeAmount),
          optionalNum(row.changePercent),
          observedAt,
          src,
        ]
      );
      upserted++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, upserted });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[POST prices/history]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.get('/api/portfolio/snapshots/history/securities', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT security FROM portfolio_snapshots_history ORDER BY security`
    );
    res.json({ securities: result.rows.map((r) => r.security) });
  } catch (e) {
    console.error('[GET snapshots/history/securities]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.get('/api/portfolio/snapshots/history/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
      params.push(String(from));
      conditions.push(`snapshot_date >= $${params.length}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) {
      params.push(String(to));
      conditions.push(`snapshot_date <= $${params.length}::date`);
    }

    let sql = `
      SELECT
        snapshot_date,
        COALESCE(SUM(market_value), 0) AS total_market_value,
        COALESCE(SUM(total_cost), 0) AS total_cost,
        COALESCE(SUM(unrealized_gain_loss), 0) AS total_unrealized_gain_loss
      FROM portfolio_snapshots_history`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` GROUP BY snapshot_date ORDER BY snapshot_date ASC`;

    const result = await pool.query(sql, params);
    res.json({
      rows: result.rows.map((r) => {
        const sd = r.snapshot_date;
        const snapshotDate =
          sd instanceof Date ? sd.toISOString().slice(0, 10) : String(sd).slice(0, 10);
        return {
          snapshotDate,
          totalMarketValue: Number(r.total_market_value),
          totalCost: Number(r.total_cost),
          totalUnrealizedGainLoss: Number(r.total_unrealized_gain_loss),
        };
      }),
    });
  } catch (e) {
    console.error('[GET snapshots/history/summary]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.get('/api/portfolio/snapshots/history', async (req, res) => {
  try {
    const { security, from, to, limit } = req.query;
    const conditions = [];
    const params = [];

    if (security && String(security).trim()) {
      params.push(String(security).trim());
      conditions.push(`security = $${params.length}`);
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
      params.push(String(from));
      conditions.push(`snapshot_date >= $${params.length}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) {
      params.push(String(to));
      conditions.push(`snapshot_date <= $${params.length}::date`);
    }

    let sql = `SELECT * FROM portfolio_snapshots_history`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY snapshot_date DESC, security`;

    const limitNum = limit ? Number(limit) : 5000;
    if (Number.isFinite(limitNum) && limitNum > 0) {
      params.push(Math.min(limitNum, 10000));
      sql += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(sql, params);
    res.json({ rows: result.rows.map(rowToPortfolioSnapshot) });
  } catch (e) {
    console.error('[GET snapshots/history]', e);
    res.status(500).json(pgErrorResponse(e));
  }
});

app.post('/api/portfolio/snapshots/history', async (req, res) => {
  const { snapshotDate, sourceFile, rows } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Body must include a non-empty rows array' });
  }
  let sd;
  try {
    sd = snapshotDateForPg(snapshotDate);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const observedAt = new Date().toISOString();
  const src = sourceFile ? String(sourceFile) : null;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    let upserted = 0;
    for (const row of rows) {
      const security = String(row.security ?? '').trim();
      if (!security) continue;

      await client.query(
        `INSERT INTO portfolio_snapshots_history (
          security, snapshot_date, quantity, cleared_balance, available_balance,
          unsettled_buy, unsettled_sell, holding_pct_qty, avg_price, bes_price,
          total_cost, traded_price, market_value, holding_pct_market_value,
          sales_commission, sales_proceeds, unrealized_gain_loss,
          unrealized_gain_loss_pct, unrealized_today_gain_loss,
          observed_at, source_file
        ) VALUES (
          $1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (security, snapshot_date) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          cleared_balance = EXCLUDED.cleared_balance,
          available_balance = EXCLUDED.available_balance,
          unsettled_buy = EXCLUDED.unsettled_buy,
          unsettled_sell = EXCLUDED.unsettled_sell,
          holding_pct_qty = EXCLUDED.holding_pct_qty,
          avg_price = EXCLUDED.avg_price,
          bes_price = EXCLUDED.bes_price,
          total_cost = EXCLUDED.total_cost,
          traded_price = EXCLUDED.traded_price,
          market_value = EXCLUDED.market_value,
          holding_pct_market_value = EXCLUDED.holding_pct_market_value,
          sales_commission = EXCLUDED.sales_commission,
          sales_proceeds = EXCLUDED.sales_proceeds,
          unrealized_gain_loss = EXCLUDED.unrealized_gain_loss,
          unrealized_gain_loss_pct = EXCLUDED.unrealized_gain_loss_pct,
          unrealized_today_gain_loss = EXCLUDED.unrealized_today_gain_loss,
          observed_at = EXCLUDED.observed_at,
          source_file = EXCLUDED.source_file,
          updated_at = now()`,
        [
          security,
          sd,
          optionalNum(row.quantity),
          optionalNum(row.clearedBalance),
          optionalNum(row.availableBalance),
          optionalNum(row.unsettledBuy),
          optionalNum(row.unsettledSell),
          optionalNum(row.holdingPctQty),
          optionalNum(row.avgPrice),
          optionalNum(row.besPrice),
          optionalNum(row.totalCost),
          optionalNum(row.tradedPrice),
          optionalNum(row.marketValue),
          optionalNum(row.holdingPctMarketValue),
          num(row.salesCommission, 0),
          num(row.salesProceeds, 0),
          optionalNum(row.unrealizedGainLoss),
          optionalNum(row.unrealizedGainLossPct),
          optionalNum(row.unrealizedTodayGainLoss),
          observedAt,
          src,
        ]
      );
      upserted++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, upserted });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[POST snapshots/history]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.put('/api/portfolio/adjustments', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a JSON object' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM portfolio_adjustments');
    for (const [security, row] of Object.entries(body)) {
      await client.query(
        `INSERT INTO portfolio_adjustments (security, sales_commission, sales_proceeds, unrealized_gain_loss)
         VALUES ($1,$2,$3,$4)`,
        [
          security,
          num(row.salesCommission, 0),
          num(row.salesProceeds, 0),
          num(row.unrealizedGainLoss, 0),
        ]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('[PUT adjustments]', e);
    res.status(500).json(pgErrorResponse(e));
  } finally {
    if (client) client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio API http://localhost:${PORT}`);
  console.log(`Loaded env from ${path.resolve(__dirname, '..', '.env')}`);
});
