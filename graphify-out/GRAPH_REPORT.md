# Graph Report - .  (2026-06-06)

## Corpus Check
- 25 files · ~19,728 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 182 nodes · 373 edges · 19 communities (14 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_PostgreSQL Backend Architecture|PostgreSQL Backend Architecture]]
- [[_COMMUNITY_Portfolio History Feature|Portfolio History Feature]]
- [[_COMMUNITY_CSV Import & Parsing|CSV Import & Parsing]]
- [[_COMMUNITY_Portfolio State (Redux)|Portfolio State (Redux)]]
- [[_COMMUNITY_AI Metadata Export|AI Metadata Export]]
- [[_COMMUNITY_Price History Feature|Price History Feature]]
- [[_COMMUNITY_Portfolio Domain Types|Portfolio Domain Types]]
- [[_COMMUNITY_Portfolio UI & Page|Portfolio UI & Page]]
- [[_COMMUNITY_State & Data Models|State & Data Models]]
- [[_COMMUNITY_Recommendation Engine|Recommendation Engine]]
- [[_COMMUNITY_AI Analysis Reports|AI Analysis Reports]]
- [[_COMMUNITY_App Entry & Public Assets|App Entry & Public Assets]]
- [[_COMMUNITY_IndexedDB Order Storage|IndexedDB Order Storage]]
- [[_COMMUNITY_Requirements Examples|Requirements Examples]]
- [[_COMMUNITY_UI Assets|UI Assets]]
- [[_COMMUNITY_Portfolio History Docs|Portfolio History Docs]]
- [[_COMMUNITY_SEO Config|SEO Config]]
- [[_COMMUNITY_Build Assets|Build Assets]]
- [[_COMMUNITY_Brand Assets|Brand Assets]]

## God Nodes (most connected - your core abstractions)
1. `apiBase()` - 14 edges
2. `PostgreSQL Persistence Plan` - 12 edges
3. `parsePortfolioRows()` - 9 edges
4. `Order` - 8 edges
5. `SecurityHolding` - 8 edges
6. `StockSplit` - 8 edges
7. `parseWatchlistRows()` - 8 edges
8. `Portfolio Feature README` - 8 edges
9. `ActionPriceRange` - 7 edges
10. `parseCSVLine()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Portfolio-7 Equity Holdings Snapshot` --semantically_similar_to--> `Portfolio AI Analysis Export (2026-01-29)`  [INFERRED] [semantically similar]
  graphify-out/converted/Portfolio-7_4ed6f975.md → portfolio-ai-analysis-2026-01-29.md
- `Root HTML Entry Point (Vite/React)` --semantically_similar_to--> `Public HTML Template (create-react-app)`  [INFERRED] [semantically similar]
  index.html → public/index.html
- `Root HTML Entry Point (Vite/React)` --references--> `App Logo 192px (React PWA apple-touch icon)`  [EXTRACTED]
  index.html → public/logo192.png
- `Portfolio Feature README` --conceptually_related_to--> `Portfolio AI Analysis Export (2026-01-29)`  [INFERRED]
  src/features/portfolio/README.md → portfolio-ai-analysis-2026-01-29.md
- `Action Price Ranges (Trading Zones)` --semantically_similar_to--> `action_price_ranges Table`  [INFERRED] [semantically similar]
  src/features/portfolio/README.md → src/features/portfolio/POSTGRESQL_PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Portfolio Data Persistence Stack** — portfolio_postgresql_plan_useportfoliocontroller, portfolio_postgresql_plan_portfolioremote, portfolio_postgresql_plan_postgresql [EXTRACTED 1.00]
- **Lot Calculation Pipeline** — portfolio_readme_csvimport, portfolio_readme_fifolomatch, portfolio_readme_portfolioanalysis [EXTRACTED 1.00]
- **AI Analysis Export Flow** — portfolio_readme_aimetadataexport, portfolio_readme_exportutils, portfolio_readme_aiworkflow [INFERRED 0.85]
- **Portfolio Equity Snapshot Time Series (Portfolio-7, -8, -9.1)** — converted_portfolio_7_4ed6f975, converted_portfolio_8_566ec337, converted_portfolio_9_1_d1f74c0e [INFERRED 0.95]
- **Epic Requirements Template (README + US + CR)** — example_epic_readme, example_epic_us_001_example_story, example_epic_us_001_cr_001 [EXTRACTED 1.00]
- **Portfolio Feature Documentation Suite** — portfolio_readme, portfolio_postgresql_plan, portfolio_ai_analysis_2026_01_29 [INFERRED 0.85]

## Communities (19 total, 5 thin omitted)

### Community 0 - "PostgreSQL Backend Architecture"
Cohesion: 0.07
Nodes (35): action_price_ranges Table, Portfolio API Server (Node/Fastify), PostgreSQL Persistence Plan, import_events Audit Table, IndexedDB (Browser Storage), localStorage (Browser Storage), lotTracker.ts (Lot Engine - Plan Reference), PostgreSQL Migration Rollout Phases (+27 more)

### Community 1 - "Portfolio History Feature"
Cohesion: 0.13
Nodes (25): PortfolioHistoryPage(), SortDir, SortKey, usePortfolioHistoryController(), apiBase(), fetchPortfolioBootstrap(), fetchPortfolioSnapshotHistory(), fetchPortfolioSnapshotSecurities() (+17 more)

### Community 2 - "CSV Import & Parsing"
Cohesion: 0.26
Nodes (16): findColumnIndex(), findPortfolioHeader(), findWatchlistHeader(), optionalField(), parseActionPriceRangesCSV(), parseCSVLine(), parseNumber(), parseOrderTrackerCSV() (+8 more)

### Community 3 - "Portfolio State (Redux)"
Cohesion: 0.20
Nodes (12): initialState, portfolioSlice, selectActionPriceRanges(), selectCurrentPrices(), selectHoldings(), selectLots(), selectOrders(), selectPortfolioError() (+4 more)

### Community 4 - "AI Metadata Export"
Cohesion: 0.32
Nodes (12): AIExportContext, appendPortfolioTrajectoryMarkdown(), appendPriceHistoryMarkdown(), enrichLotStats(), exportAIMarkdown(), exportAIMetadata(), exportAIMetadataForActionRanges(), formatPriceHistoryBlock() (+4 more)

### Community 5 - "Price History Feature"
Cohesion: 0.29
Nodes (7): PriceHistoryPage(), SortDir, SortKey, usePriceHistoryController(), PriceHistoryRow, localDateString(), tradingDateFromFile()

### Community 6 - "Portfolio Domain Types"
Cohesion: 0.24
Nodes (8): Order, PortfolioState, SecurityRecommendation, SellMatch, TradingRecommendation, calculateHoldings(), processOrdersIntoLots(), orderDedupeKey()

### Community 7 - "Portfolio UI & Page"
Cohesion: 0.24
Nodes (5): PortfolioPage(), StockSplit, usePortfolioController(), calculateRealizedGainLoss(), verifySellOrders()

### Community 8 - "State & Data Models"
Cohesion: 0.29
Nodes (7): PortfolioSliceState, ActionPriceRange, Lot, SecurityHolding, exportToCSV(), exportToMarkdown(), exportToPDF()

### Community 9 - "Recommendation Engine"
Cohesion: 0.39
Nodes (5): enrichReasonWithTrend(), generateAllRecommendations(), generateRecommendation(), isPriceInRange(), parsePriceRange()

### Community 10 - "AI Analysis Reports"
Cohesion: 0.40
Nodes (6): Portfolio-7 Equity Holdings Snapshot, Portfolio-8 Equity Holdings Snapshot, Portfolio-9.1 Equity Holdings Snapshot, Portfolio AI Analysis Export (2026-01-29), PostgreSQL Persistence Plan for Portfolio Feature, Portfolio Feature README

### Community 11 - "App Entry & Public Assets"
Cohesion: 0.67
Nodes (4): Root HTML Entry Point (Vite/React), Public HTML Template (create-react-app), App Logo 192px (React PWA apple-touch icon), App Logo 512px (React PWA manifest icon)

### Community 12 - "IndexedDB Order Storage"
Cohesion: 0.83
Nodes (3): loadOrders(), openDb(), saveOrders()

### Community 13 - "Requirements Examples"
Cohesion: 1.00
Nodes (3): Example Epic README, CR-001: Change Request Template, US-001: Example User Story Template

## Ambiguous Edges - Review These
- `import_events Audit Table` → `CSV Import (ATrad Order Tracker)`  [AMBIGUOUS]
  src/features/portfolio/POSTGRESQL_PLAN.md · relation: conceptually_related_to

## Knowledge Gaps
- **31 isolated node(s):** `initialState`, `portfolioSlice`, `PortfolioState`, `UploadingState`, `NewSplitState` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `import_events Audit Table` and `CSV Import (ATrad Order Tracker)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `parsePortfolioRows()` connect `CSV Import & Parsing` to `Portfolio History Feature`, `Portfolio State (Redux)`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `initialState`, `portfolioSlice`, `PortfolioState` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PostgreSQL Backend Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.06890756302521009 - nodes in this community are weakly interconnected._
- **Should `Portfolio History Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.12903225806451613 - nodes in this community are weakly interconnected._