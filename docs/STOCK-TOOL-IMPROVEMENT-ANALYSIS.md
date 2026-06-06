# Stock Analysis Tool — Improvement Analysis

> Generated: 2026-06-06  
> Scope: `src/features/portfolio`, `src/features/portfolio-history`, `src/features/price-history`  
> Method: graphify knowledge graph — 182 nodes · 373 edges · 19 communities

---

## Graph Summary

| Metric | Value |
|--------|-------|
| Files scanned | 25 (23 code, 2 docs) |
| Nodes extracted | 182 (129 AST + 53 semantic) |
| Edges | 373 |
| Communities | 19 |
| Import cycles | None |

### Communities Identified

| Community | Label | Nodes | Cohesion |
|-----------|-------|-------|---------|
| 0 | PostgreSQL Backend Architecture | 35 | 0.07 |
| 1 | Portfolio History Feature | 31 | 0.13 |
| 2 | CSV Import & Parsing | 17 | 0.26 |
| 3 | Portfolio State (Redux) | 15 | 0.20 |
| 4 | AI Metadata Export | 13 | — |
| 5 | Price History Feature | 12 | — |
| 6 | Portfolio Domain Types | 11 | — |
| 7 | Portfolio UI & Page | 10 | — |
| 8 | State & Data Models | 8 | — |
| 9 | Recommendation Engine | 8 | — |
| 10 | AI Analysis Reports | 6 | — |
| 12 | IndexedDB Order Storage | 4 | — |

---

## God Nodes (Most Connected — Core Abstractions)

These nodes sit at the centre of the graph. A bug or design change here cascades everywhere.

| Rank | Node | Edges | Note |
|------|------|-------|------|
| 1 | `apiBase()` | 14 | Central HTTP hub — all remote calls route through it |
| 2 | `PostgreSQL Persistence Plan` | 12 | Backend migration blueprint (doc node) |
| 3 | `parsePortfolioRows()` | 9 | CSV bridge crossing 3 communities |
| 4 | `Order` | 8 | Core domain type |
| 5 | `SecurityHolding` | 8 | Core domain type |
| 6 | `StockSplit` | 8 | Adjustment event — cost-basis risk |
| 7 | `parseWatchlistRows()` | 8 | Parallel CSV entry point |
| 8 | `Portfolio Feature README` | 8 | Doc node bridging concepts |
| 9 | `ActionPriceRange` | 7 | Trading zone concept |
| 10 | `parseCSVLine()` | 7 | Low-level parser shared by all importers |

---

## Surprising Connections

These edges were found by the graph that you likely wouldn't discover from reading code alone.

- **Portfolio-7 Equity Snapshot ↔ AI Analysis Export (2026-01-29)** — the same equity data surfaces in two separate AI export pipelines with no shared code path between them.
- **`Action Price Ranges` (frontend concept) ↔ `action_price_ranges` Table (DB plan)** — structurally disconnected; the planned PostgreSQL table has no write path in current code. The migration hasn't landed.
- **`Portfolio Feature README` → `Portfolio AI Analysis Export`** — documentation references analysis exports that are not wired into the main portfolio page UI.

---

## Improvement Findings

### 1. `apiBase()` Is a Single Point of Failure
**Impact: High**

Every remote call — snapshot history, securities, bootstrap — routes through a single `apiBase()` function (14 edges in the graph). No retry logic, circuit breaker, or API-layer error boundary is visible in the codebase.

**What to do:**
- Wrap `apiBase()` with a retry/timeout decorator (e.g. exponential back-off for transient failures)
- Add an error boundary or global error state in the Redux slice so a failed call degrades gracefully instead of silently breaking the UI
- Consider splitting into domain-specific API clients (`portfolioApi`, `priceApi`) so failures are scoped

---

### 2. IndexedDB → PostgreSQL Migration Is Half-Done
**Impact: High**

`IndexedDB Order Storage` (Community 12) and `PostgreSQL Backend Architecture` (Community 0) are separate graph communities with no code path connecting them. The `action_price_ranges`, `stock_splits`, and `import_events` tables exist in the plan document but have no corresponding insert/read paths in the application code.

**What to do:**
- Implement the `portfolioRemote.ts` API calls for the planned tables (`portfolio_orders`, `stock_splits`, `security_prices`)
- Add a migration flag/toggle so the app can switch data sources without a full redeploy
- Write a one-time migration script to move existing IndexedDB data to PostgreSQL on first load

---

### 3. Recommendation Engine Is Disconnected from Historical Data
**Impact: High**

The `Recommendation Engine` (Community 9 — `generateAllRecommendations()`, `enrichReasonWithTrend()`) has **zero graph edges** to `Portfolio History Feature` (Community 1) or `Price History Feature` (Community 5). Recommendations are generated without access to historical price trends or past portfolio snapshots.

**What to do:**
- Feed `fetchPortfolioSnapshotHistory()` output into the recommendation context
- Connect `enrichReasonWithTrend()` to the price history data so trend direction informs the recommendation reason text
- Add a `usePriceHistory` hook dependency inside `useRecommendationEngine` or equivalent controller

---

### 4. AI Export Is Write-Only — No Feedback Loop
**Impact: Medium**

`AI Metadata Export` (Community 4 — `appendPortfolioTrajectoryMarkdown`, `appendPriceHistoryMarkdown`) pushes data out to markdown files for external AI analysis. There is no node in the graph representing AI results coming *back* into the app to influence `ActionPriceRange` targets or `SecurityRecommendation` outputs.

**What to do:**
- Add an import flow for AI-generated suggestions (e.g. parse a structured JSON response from the AI and store results in the Redux slice)
- Surface AI-suggested price targets alongside manually set `ActionPriceRange` values in the UI
- Track AI suggestion history alongside portfolio snapshots for longitudinal comparison

---

### 5. CSV Is the Only Data Ingestion Path
**Impact: Medium**

`CSV Import & Parsing` (Community 2, cohesion 0.26 — the most internally coherent module) is the **sole ingestion mechanism** for orders, watchlists, and price data. `parsePortfolioRows()` is a cross-community bridge node touching 3 communities — a parsing bug here cascades into portfolio state, history, and price history simultaneously.

**What to do:**
- Add a broker API connector (e.g. REST integration with a brokerage or data provider) as an alternative ingestion path
- Introduce a real-time price feed (WebSocket or polling) so the app doesn't require manual CSV exports to stay current
- Add schema validation and typed error reporting at the CSV parser boundary so malformed rows surface early rather than corrupting downstream state

---

### 6. StockSplit Has No Visible Cost-Basis Recalculation Path
**Impact: Medium**

`StockSplit` is a god node (8 edges) connecting to domain types and state — but the graph shows no code path from `StockSplit` to FIFO lot cost-basis recalculation. The lot matching hyperedge (`CSV Import → FIFO Lot Match → Portfolio Analysis`) does not include `StockSplit` as a participant.

**What to do:**
- Implement a `recalculateLotCostBasis(split: StockSplit, lots: Lot[])` function and wire it into the lot engine
- Ensure split-adjusted cost basis is applied before P&L calculations are surfaced to the user
- Add a test case: 2:1 split on a 100-share lot at $50 → 200 shares at $25, total cost unchanged

---

## Hyperedges (Group Relationships)

These are multi-node relationships the pairwise graph can't capture alone:

| Hyperedge | Participants | Confidence |
|-----------|-------------|------------|
| Portfolio Data Persistence Stack | `usePortfolioController` · `portfolioRemote.ts` · PostgreSQL | 1.00 |
| Lot Calculation Pipeline | CSV Import · FIFO Lot Match · Portfolio Analysis | 1.00 |
| AI Analysis Export Flow | `aiMetadataExport` · `exportUtils` · AI Workflow | 0.85 |
| Portfolio Equity Snapshot Time Series | Portfolio-7 · Portfolio-8 · Portfolio-9.1 | 0.95 |

---

## Suggested Next Queries

Run these against the graph to go deeper:

```bash
graphify query "How does the recommendation engine connect to price history?"
graphify query "What calls apiBase and what happens on failure?"
graphify query "What is the data flow for stock split cost basis adjustment?"
graphify path "parsePortfolioRows" "PortfolioState"
graphify explain "ActionPriceRange"
```

---

## Priority Roadmap

| Priority | Finding | Effort | Value |
|----------|---------|--------|-------|
| P1 | Connect Recommendation Engine to price/history data | Medium | Very High |
| P1 | Complete IndexedDB → PostgreSQL migration | High | Very High |
| P2 | Add retry/circuit-breaker to `apiBase()` | Low | High |
| P2 | StockSplit cost-basis recalculation | Medium | High |
| P3 | AI export feedback loop (import AI results back) | Medium | Medium |
| P3 | Add broker API / real-time price feed | High | Medium |
