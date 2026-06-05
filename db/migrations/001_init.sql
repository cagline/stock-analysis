-- Portfolio feature persistence (single-tenant local dev). Run via npm run db:migrate.

CREATE TABLE IF NOT EXISTS portfolio_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  security TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  order_qty NUMERIC NOT NULL,
  order_price NUMERIC NOT NULL,
  order_value NUMERIC NOT NULL,
  order_date DATE NOT NULL,
  order_time TEXT NOT NULL DEFAULT '',
  order_datetime TIMESTAMPTZ,
  exchange_order_id TEXT NOT NULL DEFAULT '',
  execution_id TEXT,
  filled_qty NUMERIC NOT NULL,
  remaining_qty NUMERIC NOT NULL,
  order_status TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_splits (
  id TEXT PRIMARY KEY,
  security TEXT NOT NULL,
  split_date DATE NOT NULL,
  split_datetime TEXT NOT NULL,
  ratio NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_prices (
  security TEXT PRIMARY KEY,
  last_price NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS action_price_ranges (
  security TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_adjustments (
  security TEXT PRIMARY KEY,
  sales_commission NUMERIC NOT NULL DEFAULT 0,
  sales_proceeds NUMERIC NOT NULL DEFAULT 0,
  unrealized_gain_loss NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
