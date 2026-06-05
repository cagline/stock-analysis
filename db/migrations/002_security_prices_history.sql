-- Daily watchlist snapshots (one row per security per trading day).

CREATE TABLE IF NOT EXISTS security_prices_history (
  security TEXT NOT NULL,
  trading_date DATE NOT NULL,
  last_price NUMERIC NOT NULL,
  bid_price NUMERIC,
  ask_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  volume NUMERIC,
  turnover NUMERIC,
  change_amount NUMERIC,
  change_percent NUMERIC,
  observed_at TIMESTAMPTZ NOT NULL,
  source_file TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (security, trading_date)
);

CREATE INDEX IF NOT EXISTS idx_security_prices_history_date
  ON security_prices_history (trading_date);
