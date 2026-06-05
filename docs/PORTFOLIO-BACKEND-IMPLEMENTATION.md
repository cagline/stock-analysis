# Portfolio backend implementation

This document describes how **PostgreSQL persistence** and the **Portfolio API** are wired into the Stocks app for `src/features/portfolio`.

Related: [POSTGRESQL_PLAN.md](../src/features/portfolio/POSTGRESQL_PLAN.md) (original schema/API plan), [portfolio README](../src/features/portfolio/README.md) (feature usage).

---

## Architecture

```
Browser (Vite dev server, port 5173)
  → fetch('/api/...')   same origin
  → Vite proxy forwards /api → http://localhost:3002
  → Express (server/portfolio-api.mjs)
  → pg Pool → PostgreSQL (Docker: postgres:16-alpine, port 5432)
```

The React app **never** connects to Postgres directly. Secrets stay on the server via `DATABASE_URL` in `.env` at the **repository root** (not exposed to Vite).

---

## Repository layout

| Path | Role |
|------|------|
| `docker-compose.yml` | Local Postgres service + volume `stocks_pg_data` |
| `.env` / `.env.example` | `DATABASE_URL`, `POSTGRES_*`, optional `PORTFOLIO_API_PORT` (default **3002**) |
| `db/migrations/001_init.sql` | Creates `portfolio_orders`, `stock_splits`, `security_prices`, `action_price_ranges`, `portfolio_adjustments` |
| `db/migrations/002_security_prices_history.sql` | Daily watchlist snapshots (`security_prices_history`) |
| `scripts/db-migrate.mjs` | Applies all SQL migrations in order; loads `.env` from repo root |
| `server/portfolio-api.mjs` | Express API: bootstrap + PUT endpoints; loads `.env` from repo root |
| `vite.config.ts` | `server.proxy['/api']` → `http://localhost:3002` |
| `src/features/portfolio/utils/portfolioRemote.ts` | Client `fetch` helpers |
| `src/features/portfolio/utils/orderDedupeKey.ts` | Dedupe key shared with merge logic in `portfolioSlice` |
| `src/features/portfolio/usePortfolioController.ts` | Bootstraps from API or falls back to IndexedDB / `localStorage` |

---

## NPM scripts

| Script | Purpose |
|--------|---------|
| `npm run docker:db` | Start Postgres container |
| `npm run docker:db:down` | Stop containers |
| `npm run db:migrate` | Run all `db/migrations/*.sql` against `DATABASE_URL` |
| `npm run portfolio-api` | Start Portfolio API (default port 3002) |
| `npm run dev` | Vite; proxies `/api` to the API |

Typical local workflow:

1. `npm run docker:db`
2. Copy `.env.example` → `.env` if needed
3. `npm run db:migrate`
4. Terminal A: `npm run portfolio-api`
5. Terminal B: `npm run dev`

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | `.env` (root), **server only** | PostgreSQL connection string, e.g. `postgresql://stocks:PASSWORD@localhost:5432/stocks` |
| `POSTGRES_*` | `.env` | Used by Docker Compose for the container |
| `PORTFOLIO_API_PORT` | `.env` | API listen port (default **3002**). If you change it, update `vite.config.ts` proxy `target` to match. |
| `VITE_PORTFOLIO_API_BASE` | Optional, **client** | Base URL for API calls. **Unset in dev** so requests use relative `/api` and the Vite proxy. Set in production if the API is on another origin. |

---

## HTTP API

Base URL in development: same origin, path prefix `/api` (via proxy).

### Diagnostics

- `GET /api/health` — `{ ok: true }` (process up)
- `GET /api/health/db` — `{ ok: true, database: "up" }` or `500` with `{ error, code?, hint? }`

### Portfolio

- `GET /api/portfolio/bootstrap` — Single payload:
  - `orders`, `stockSplits`, `currentPrices`, `actionPriceRanges`, `portfolioAdjustments`
  - Matches shapes used by Redux / local state (camelCase JSON).

- `PUT /api/portfolio/orders` — JSON array of `Order` (full replace: delete all rows, then insert).

- `PUT /api/portfolio/stock-splits` — JSON array of `StockSplit` (full replace).

- `PUT /api/portfolio/prices` — JSON object `Record<string, number>` (full replace).

- `PUT /api/portfolio/action-ranges` — JSON object `Record<string, ActionPriceRange>` (full replace); stored as JSONB per row.

- `PUT /api/portfolio/adjustments` — JSON object keyed by security with `{ salesCommission, salesProceeds, unrealizedGainLoss }` (full replace).

### Price history (watchlist snapshots)

- `GET /api/portfolio/prices/history` — Query daily history. Query params: `security?`, `from?` (YYYY-MM-DD), `to?`, `limit?`. Returns `{ rows: PriceHistoryRow[] }`.

- `GET /api/portfolio/prices/history/securities` — Distinct securities in history. Returns `{ securities: string[] }`.

- `POST /api/portfolio/prices/history` — Upsert batch from watchlist parse. Body: `{ tradingDate, sourceFile?, rows: WatchlistRow[] }`. One row per `(security, trading_date)`; same day re-upload updates that row.

- `POST /api/portfolio/snapshots/history` — Upsert batch from portfolio parse. Body: `{ snapshotDate, sourceFile?, rows: PortfolioRow[] }`.

- `GET /api/portfolio/snapshots/history` — Query portfolio snapshots (`security?`, `from?`, `to?`, `limit?`).

- `GET /api/portfolio/snapshots/history/securities` — Distinct securities in portfolio history.

**Semantics:** Each PUT **replaces** that table’s data for the single-tenant dev database (no `user_id` in v1). Price and portfolio history use **upsert** per security + date instead of full replace.

**Errors:** Many failures return JSON `{ error, code?, hint? }` using PostgreSQL error codes when applicable (`42P01` missing tables, `28P01` auth, etc.).

### Full table replace for orders (why and efficiency)

**What happens:** `PUT /api/portfolio/orders` runs inside a transaction: `DELETE FROM portfolio_orders`, then one `INSERT` per row in the request body. Implementation: `server/portfolio-api.mjs`.

**Duplicate “same” orders:** The client already collapses duplicates **before** sync using `mergeOrders` + `orderDedupeKey` (same logical fill → one array element). The API stores each row’s `dedupe_key` (same formula as the client). So the payload has **at most one row per key**; the DB mirrors the merged Redux list exactly.

**Why not row-by-row upsert only:** Full replace keeps the database equal to the **current** app state without orphan rows (e.g. an order removed in the UI must disappear in Postgres). The pattern is simple and correct for a single-user mirror.

**Efficiency:** For typical personal portfolios (hundreds to a few thousand fills), one delete + batch insert per debounced save is **acceptable** on Postgres. Tradeoffs: more WAL / index work than updating only changed rows. If you ever need to optimize: use `INSERT ... ON CONFLICT (dedupe_key) DO UPDATE` plus `DELETE ... WHERE dedupe_key NOT IN (...)` for rows dropped from the app, or send diffs from the client.

**Other tables:** `stock-splits`, `prices`, `action-ranges`, and `adjustments` use the same **delete-all then insert-all** pattern per PUT for consistency.

---

## Client behavior (`usePortfolioController`)

1. On mount, calls `fetchPortfolioBootstrap()` → `GET /api/portfolio/bootstrap`.
2. **If the response is OK:** Dispatches Redux (`setOrders`, `setStockSplits`, `setCurrentPrices`, `setActionPriceRanges`) and merges `portfolioAdjustments` into component state. Enables **`portfolioApiEnabled`**.
   - If server returns **empty orders** but **IndexedDB** has orders, uploads those orders once (`PUT /api/portfolio/orders`) and keeps UI in sync.
   - Same pattern for **empty splits** vs **`localStorage`** (`portfolio_stockSplits`).
3. **If bootstrap fails** (network, 500, API down): Loads orders from IndexedDB and splits from `localStorage` only; **`portfolioApiEnabled`** stays false.
4. **Persistence while `portfolioApiEnabled`:**
   - Debounced (~500 ms) PUTs when `orders`, `stockSplits`, `currentPrices`, `actionPriceRanges`, or `portfolioData` change.
5. **Persistence while API disabled:**
   - Orders → IndexedDB (`orderTrackerDb.ts`)
   - Splits → `localStorage` key `portfolio_stockSplits`

Derived state (**lots**, **holdings**) remains computed client-side (`lotTracker.ts`); not stored in Postgres in this phase.

---

## CSV upload merge behavior (same row vs new rows)

There are **four** uploads on the portfolio flow (Order Tracker, Watchlist, Portfolio, Action Price Ranges). Each behaves differently when you upload again.

### 1. Order Tracker CSV — **merge by logical fill key**

- Redux uses **`mergeOrders`** (not a full replace).
- **Same fill as before:** identified by `executionId` if present, otherwise  
  `` `${exchangeOrderId}|${orderDate}|${orderTime}` `` — see `orderDedupeKey.ts`.
- **Effect:** If that key already exists in memory, the incoming row **replaces** the old one (broker corrections, re-export). If the key is new, the row is **appended**.
- **Within one CSV file:** For rows sharing the same Exchange Order Id, the parser keeps only the **complete fill** (`Remaining Qty = 0`), first occurrence wins for that id.

After merge, the **full orders array** is synced to Postgres (replace-all `PUT`), so the database always mirrors the merged in-memory list.

### 2. Watchlist CSV — **merge by ticker + daily history**

- Parsed rows update **`setCurrentPrices`**:  
  `currentPrices = { ...existing, ...fromUpload }`.
- **Same security again:** last uploaded **Last** price **wins** in Redux and `security_prices`.
- **Daily history:** When the Portfolio API is enabled, each upload also **upserts** into `security_prices_history` for the selected **trading date** (default: today). Same security + same trading date → row is updated, not duplicated.
- Use the **Trading date** field on Portfolio or the **Price History** page (`/price-history`) when the export is from an earlier session.
- **Auto date:** On upload, trading date defaults to the file's **saved/modified date** (`file.lastModified`). Change the picker **before** selecting a file to override.
- **Securities only in an older upload:** they **stay** in `currentPrices` until overwritten — they are **not** removed if missing from the latest file.

### 3. Portfolio CSV / Excel — **replace snapshot + daily history**

- **`setPortfolioData(parsed)`** replaces the in-memory adjustment map (commission / proceeds / unrealized) for the current session.
- **Daily history:** When the Portfolio API is enabled, each upload also **upserts** into `portfolio_snapshots_history` for the selected **snapshot date** (default: file saved date). Supports `.csv`, `.xlsx`, and `.xls`.
- **Effect on current state:** Only securities in the latest file affect `portfolioData`; others may disappear from the current snapshot until uploaded again.

### 4. Action Price Ranges CSV — **replace snapshot**

- **`setActionPriceRanges(parsed)`** replaces the entire `actionPriceRanges` object.
- **Effect:** Same idea as Portfolio CSV for this slice: the UI state is **only** what the latest file contained (per row). Tickers not in the new file are **dropped** from action ranges until you upload them again.

### Summary

| Upload | Same record again | New records in same file |
|--------|---------------------|----------------------------|
| Order Tracker | Updates that fill in place (same dedupe key) | Added to the list |
| Watchlist | Updates price for that ticker; upserts daily history row for trading date | New tickers added; old tickers not in file kept in current prices |
| Portfolio CSV | Overwrites that security if still in file | Only securities in file affect state; others may be lost |
| Action ranges | Overwrites that security if still in file | Tickers not in latest file removed from ranges state |

---

## Database schema (summary)

- **`portfolio_orders`** — One row per logical fill; `dedupe_key` UNIQUE (aligned with `orderDedupeKey`).
- **`stock_splits`** — `id` TEXT PK (client-generated ids).
- **`security_prices`** — One row per ticker `last_price` (current snapshot).
- **`security_prices_history`** — One row per `(security, trading_date)`; watchlist daily snapshots for forecasting/trends.
- **`action_price_ranges`** — `security` PK, `data` JSONB.
- **`portfolio_snapshots_history`** — One row per `(security, snapshot_date)`; full portfolio export snapshots.
- **`portfolio_adjustments`** — Per-security commission / proceeds / unrealized G/L (latest snapshot for lot tracker).

Full DDL: `db/migrations/001_init.sql`, `db/migrations/002_security_prices_history.sql`, `db/migrations/003_portfolio_snapshots_history.sql`.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `500` on bootstrap | Response JSON `hint`; run `npm run db:migrate`; confirm Docker Postgres healthy |
| `code: "42P01"` | Tables missing — migrate |
| `code: "28P01"` | `DATABASE_URL` password/user mismatch vs `docker-compose.yml` |
| Connection refused | `npm run docker:db`; confirm port 5432 |
| Vite `/api` fails | Is `npm run portfolio-api` running? Default port **3002** must match `vite.config.ts` proxy |
| Old routes / odd behavior | Restart `portfolio-api`; avoid multiple Node processes on the same port |

Always start the API from any directory; **`dotenv`** resolves `.env` from the **repository root** relative to `server/portfolio-api.mjs`.

---

## Production notes

- Run the API behind HTTPS; set `VITE_PORTFOLIO_API_BASE` to the public API origin if the SPA is hosted separately.
- Add authentication and per-user scoping (e.g. `user_id` + RLS or API checks); current schema is single-tenant.
- Consider replacing “full table replace” PUTs with upserts or versioning if multiple clients sync concurrently.

---

*Last updated to match the implementation in this repository.*
