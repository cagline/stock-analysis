-- Daily portfolio snapshots (one row per security per snapshot date).

CREATE TABLE IF NOT EXISTS portfolio_snapshots_history (
  security TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  quantity NUMERIC,
  cleared_balance NUMERIC,
  available_balance NUMERIC,
  unsettled_buy NUMERIC,
  unsettled_sell NUMERIC,
  holding_pct_qty NUMERIC,
  avg_price NUMERIC,
  bes_price NUMERIC,
  total_cost NUMERIC,
  traded_price NUMERIC,
  market_value NUMERIC,
  holding_pct_market_value NUMERIC,
  sales_commission NUMERIC NOT NULL DEFAULT 0,
  sales_proceeds NUMERIC NOT NULL DEFAULT 0,
  unrealized_gain_loss NUMERIC,
  unrealized_gain_loss_pct NUMERIC,
  unrealized_today_gain_loss NUMERIC,
  observed_at TIMESTAMPTZ NOT NULL,
  source_file TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (security, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_history_date
  ON portfolio_snapshots_history (snapshot_date);
