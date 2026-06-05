# PostgreSQL persistence plan — Portfolio feature

This document describes how to move portfolio-related data from **browser storage** (IndexedDB for orders, `localStorage` for splits; Redux for the rest) to **PostgreSQL**, while keeping the existing **client-side lot engine** (`lotTracker.ts`) as the source of truth for derived fields (`lots`, `holdings`).

## Goals

- **Durable records**: orders, splits, and supporting inputs survive clearing site data or switching devices.
- **Single source of truth** for *raw* inputs in Postgres; **derived** state remains computed in the app (optional later: materialized snapshots for audit).
- **Safe evolution**: incremental rollout; optional fallback to IndexedDB/localStorage during development.
- **SQL fit**: orders and FIFO lots map naturally to relational rows; constraints and uniqueness prevent duplicate fills.

## Current vs target

| Data | Today | Postgres target |
|------|--------|------------------|
| Orders | `utils/orderTrackerDb.ts` (IndexedDB) | Table `portfolio_orders` |
| Stock splits | `localStorage` key `portfolio_stockSplits` | Table `stock_splits` |
| Current prices | Redux only | Table `security_prices` (or merge from watchlist import) |
| Action price ranges | Redux only | Table `action_price_ranges` (one row per security) |
| Portfolio CSV adjustments | Component state (`portfolioData`) | Table `portfolio_adjustments` (per security, from CAL portfolio CSV) |
| Lots / holdings | Derived in Redux | **Not stored** initially (recompute from orders + splits + prices) |

## Architecture

```
Browser (Vite/React)
  → HTTPS API (small backend: Node/Fastify, Next API routes, or serverless)
  → PostgreSQL (managed: Neon, Supabase, RDS, Cloud SQL)
```

**Do not** connect the browser directly to Postgres. Use an API with auth and parameterized queries (or an ORM).

**Local development with Docker (this repo)**

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows).
2. Copy `.env.example` to `.env` and change the password if you like.
3. From the repo root: `npm run docker:db` (or `docker compose up -d`).
4. Postgres listens on `localhost` and `${POSTGRES_PORT:-5432}`. Connection string: `DATABASE_URL` in `.env`.
5. Stop containers: `npm run docker:db:down`. Data persists in the Docker volume `stocks_pg_data` until you remove it (`docker compose down -v`).

### Implemented in this repo

- Schema: `db/migrations/001_init.sql` — apply with `npm run db:migrate` (requires `DATABASE_URL` in `.env`).
- API: `server/portfolio-api.mjs` — run with `npm run portfolio-api`.
- Client: `utils/portfolioRemote.ts`, `utils/orderDedupeKey.ts`; `usePortfolioController` loads `/api/portfolio/bootstrap` and debounces PUTs.
- Dev proxy: `vite.config.ts` forwards `/api` → `http://localhost:3002`.

**Recommended stack (pick one)**:

- **Docker Compose** (root `docker-compose.yml`) — local Postgres without a host install.
- **Neon + serverless functions** or **Vercel + Postgres** — minimal ops, good free tier.
- **Supabase** — Postgres + Auth + RLS if you want Row Level Security in the database itself.

## Schema (initial)

Types align with `types.ts` (`Order`, `StockSplit`, `ActionPriceRange`). Use `NUMERIC` for money and quantities where precision matters.

### `portfolio_orders`

One row per logical fill (matches merge key in `portfolioSlice`: `execution_id` when set, else composite).

| Column | Type | Notes |
|--------|------|--------|
| `id` | `UUID` PK | Server-generated; keep client `id` in `client_order_id` if needed |
| `user_id` | `UUID` FK | If multi-user; omit or constant for single-user |
| `security` | `TEXT` NOT NULL | |
| `side` | `TEXT` CHECK (`BUY` \| `SELL`) | |
| `order_qty` | `NUMERIC` | |
| `order_price` | `NUMERIC` | |
| `order_value` | `NUMERIC` | |
| `order_date` | `DATE` | From CSV |
| `order_time` | `TIME` or `TEXT` | As exported |
| `order_datetime` | `TIMESTAMPTZ` | Normalized if possible |
| `exchange_order_id` | `TEXT` | |
| `execution_id` | `TEXT` NULL | Unique per fill when broker provides it |
| `filled_qty` | `NUMERIC` | |
| `remaining_qty` | `NUMERIC` | |
| `order_status` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ` DEFAULT `now()` | |
| `updated_at` | `TIMESTAMPTZ` | |

**Uniqueness**: partial unique index on `(user_id, execution_id)` where `execution_id IS NOT NULL`; else unique on `(user_id, exchange_order_id, order_date, order_time)` (adjust to match real broker dedup rules).

### `stock_splits`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `TEXT` PK or `UUID` | Matches app `StockSplit.id` |
| `user_id` | `UUID` FK | Optional |
| `security` | `TEXT` NOT NULL | |
| `split_date` | `DATE` | |
| `split_datetime` | `TIMESTAMPTZ` | |
| `ratio` | `NUMERIC` NOT NULL | e.g. 3 for 3:1 |

### `security_prices`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | `UUID` FK | Optional |
| `security` | `TEXT` NOT NULL | PK with user_id |
| `last_price` | `NUMERIC` NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | |

### `action_price_ranges`

Either JSONB for the full `ActionPriceRange` or normalized columns. **MVP**: one row per security, `data JSONB NOT NULL` storing the object from `types.ts` (except `security` duplicated as column for queries).

### `portfolio_adjustments`

From `parsePortfolioCSV` / `PortfolioData`: commission, proceeds, unrealized G/L per security.

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | `UUID` | Optional |
| `security` | `TEXT` | |
| `sales_commission` | `NUMERIC` | |
| `sales_proceeds` | `NUMERIC` | |
| `unrealized_gain_loss` | `NUMERIC` | |
| `updated_at` | `TIMESTAMPTZ` | |

Unique `(user_id, security)` or single-user composite PK.

### Optional: `import_events`

Audit trail: `id`, `user_id`, `kind` (`order_tracker` \| `watchlist` \| `portfolio` \| `action_ranges`), `filename`, `row_count`, `created_at`. Helps debugging CSV uploads.

## API surface (minimal)

- `GET /api/portfolio/bootstrap` — returns orders, splits, prices, action ranges, adjustments (one payload or parallel requests).
- `PUT /api/portfolio/orders` — replace-all or upsert batch (mirror `mergeOrders` semantics server-side or send merged array from client after merge).
- `POST /api/portfolio/orders:merge` — body: new rows; server applies same dedup key as client.
- `PUT /api/portfolio/stock-splits` — full list or CRUD by id.
- `PUT /api/portfolio/prices` — map of security → price.
- `PUT /api/portfolio/action-ranges` — JSON map or list.
- `PUT /api/portfolio/adjustments` — per-security adjustments.

Prefer **idempotent upserts** for orders keyed by `execution_id` / composite key to avoid duplicates on retry.

## Client integration steps (`usePortfolioController`)

1. Add a **repository** module (e.g. `utils/portfolioApi.ts`) that maps API DTOs ↔ `types.ts`.
2. On mount: try API first; if offline/unauthenticated, fall back to `loadOrdersFromDb` + `localStorage` for splits (feature flag or env).
3. On change: debounced **sync** to API (orders, splits) instead of—or in addition to—IndexedDB effects.
4. Replace local-only `portfolioData` with load/save to `portfolio_adjustments`.
5. Remove or keep IndexedDB as offline cache only once API is stable.

## Security

- Authenticate API (session JWT, Supabase Auth, etc.).
- Use **parameterized queries**; never string-concat SQL.
- If multi-user: enforce `user_id` on every query; prefer **RLS** (Supabase) or explicit `WHERE user_id = :sub` in the API.
- **Secrets**: database URL only on server; never in Vite client bundle.

## Migration / rollout phases

1. **Phase 0**: Add Postgres + API in dev; seed from export JSON/CSV.
2. **Phase 1**: Persist **orders** + **stock_splits** only; verify FIFO output matches current app.
3. **Phase 2**: Add **prices**, **action_price_ranges**, **portfolio_adjustments**.
4. **Phase 3**: Optional IndexedDB as offline queue; background sync.
5. **Phase 4**: Deprecate direct IndexedDB/localStorage for portfolio (read-once migrate, then clear).

## Testing

- Golden-file or snapshot tests: given fixed `orders` + `splits` + `prices`, `processOrdersIntoLots` / `calculateHoldings` output unchanged after switching load path to API.
- API contract tests for upsert idempotency (same CSV uploaded twice → same row count).

## Out of scope (for later)

- Storing **materialized lots** in DB (useful for large histories or server-side reporting).
- Full **watchlist** feature module (only prices if imported from watchlist CSV).

---

*Last updated: aligned with `portfolioSlice.ts`, `usePortfolioController.ts`, and `types.ts` in this folder.*
